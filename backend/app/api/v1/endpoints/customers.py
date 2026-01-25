from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import csv
import io
import logging

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.models.customer import Customer
from app.models.message import Message
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse,
    CustomerImportResult,
    CustomerConsolidatedView,
    CustomerChatRequest,
    CustomerChatResponse
)
from app.core.deps import get_current_user
from app.models.customer_ask import CustomerAsk

# Alias for backward compatibility
Feature = CustomerAsk
from app.services.customer_chat_service import get_customer_chat_service

router = APIRouter()


@router.get("/", response_model=CustomerListResponse)
def list_customers(
    workspace_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    industry: Optional[str] = None,
    min_arr: Optional[float] = None,
    max_arr: Optional[float] = None,
    search: Optional[str] = None,
    deal_stage: Optional[str] = None,
    min_messages: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all customers for a workspace with filtering and pagination
    """
    query = db.query(Customer).filter(Customer.workspace_id == workspace_id)

    # Apply filters
    if industry:
        query = query.filter(Customer.industry == industry)

    if min_arr is not None:
        query = query.filter(Customer.arr >= min_arr)

    if max_arr is not None:
        query = query.filter(Customer.arr <= max_arr)

    if deal_stage:
        query = query.filter(Customer.deal_stage == deal_stage)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_term)) |
            (Customer.domain.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Get paginated results with message counts in a single query (avoid N+1)
    from sqlalchemy.orm import aliased
    from sqlalchemy import case

    # Subquery to count messages per customer
    message_count_subq = (
        db.query(
            Message.customer_id,
            func.count(Message.id).label('message_count')
        )
        .group_by(Message.customer_id)
        .subquery()
    )

    # Join customers with message counts
    customers_query = (
        query
        .outerjoin(message_count_subq, Customer.id == message_count_subq.c.customer_id)
        .add_columns(func.coalesce(message_count_subq.c.message_count, 0).label('message_count'))
    )

    # Apply min_messages filter if specified
    if min_messages is not None and min_messages > 0:
        customers_query = customers_query.having(func.coalesce(message_count_subq.c.message_count, 0) >= min_messages)

    customers_with_counts = (
        customers_query
        .order_by(Customer.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Build response objects
    customer_responses = []
    for customer, message_count in customers_with_counts:
        customer_dict = {
            **customer.__dict__,
            'message_count': message_count
        }
        customer_responses.append(CustomerResponse(**customer_dict))

    return CustomerListResponse(
        customers=customer_responses,
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific customer by ID
    """
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.workspace_id == workspace_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Add message count
    message_count = db.query(func.count(Message.id)).filter(
        Message.customer_id == customer.id
    ).scalar()

    customer_dict = {
        **customer.__dict__,
        'message_count': message_count
    }

    return CustomerResponse(**customer_dict)


@router.post("/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_data: CustomerCreate,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new customer manually
    """
    # Check if customer with same domain already exists
    if customer_data.domain:
        existing = db.query(Customer).filter(
            Customer.workspace_id == workspace_id,
            Customer.domain == customer_data.domain
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer with domain '{customer_data.domain}' already exists"
            )

    customer = Customer(
        workspace_id=workspace_id,
        **customer_data.model_dump()
    )

    db.add(customer)
    db.commit()
    db.refresh(customer)

    customer_dict = {
        **customer.__dict__,
        'message_count': 0
    }

    return CustomerResponse(**customer_dict)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    customer_data: CustomerUpdate,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing customer
    """
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.workspace_id == workspace_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Update only provided fields
    update_data = customer_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)

    # Add message count
    message_count = db.query(func.count(Message.id)).filter(
        Message.customer_id == customer.id
    ).scalar()

    customer_dict = {
        **customer.__dict__,
        'message_count': message_count
    }

    return CustomerResponse(**customer_dict)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: UUID,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a customer (soft delete by setting is_active=False)
    """
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.workspace_id == workspace_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Soft delete
    customer.is_active = False
    db.commit()

    return None


@router.post("/upload-csv", response_model=CustomerImportResult)
async def upload_customers_csv(
    workspace_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload customers from a CSV file

    Expected CSV columns:
    - name (required)
    - domain (optional)
    - industry (optional)
    - website (optional)
    - phone (optional)
    - mrr (optional, number)
    - arr (optional, number)
    - deal_stage (optional)
    - deal_amount (optional, number)
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV"
        )

    try:
        # Read CSV file
        contents = await file.read()
        csv_data = io.StringIO(contents.decode('utf-8'))
        csv_reader = csv.DictReader(csv_data)

        success_count = 0
        error_count = 0
        errors = []
        created_ids = []

        for row_num, row in enumerate(csv_reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Validate required fields
                if not row.get('name') or not row.get('name').strip():
                    errors.append({
                        'row': row_num,
                        'error': 'Name is required',
                        'data': row
                    })
                    error_count += 1
                    continue

                # Check if customer already exists by domain
                domain = row.get('domain', '').strip() or None
                if domain:
                    existing = db.query(Customer).filter(
                        Customer.workspace_id == workspace_id,
                        Customer.domain == domain
                    ).first()

                    if existing:
                        # Update existing customer instead of creating new
                        existing.name = row.get('name', '').strip()
                        existing.industry = row.get('industry', '').strip() or None
                        existing.website = row.get('website', '').strip() or None
                        existing.phone = row.get('phone', '').strip() or None

                        # Update numeric fields
                        if row.get('mrr'):
                            try:
                                existing.mrr = float(row['mrr'])
                            except ValueError:
                                pass

                        if row.get('arr'):
                            try:
                                existing.arr = float(row['arr'])
                            except ValueError:
                                pass

                        if row.get('deal_amount'):
                            try:
                                existing.deal_amount = float(row['deal_amount'])
                            except ValueError:
                                pass

                        existing.deal_stage = row.get('deal_stage', '').strip() or None

                        created_ids.append(existing.id)
                        success_count += 1
                        continue

                # Parse numeric fields
                mrr = None
                arr = None
                deal_amount = None

                if row.get('mrr'):
                    try:
                        mrr = float(row['mrr'])
                    except ValueError:
                        errors.append({
                            'row': row_num,
                            'error': f"Invalid MRR value: {row['mrr']}",
                            'data': row
                        })
                        error_count += 1
                        continue

                if row.get('arr'):
                    try:
                        arr = float(row['arr'])
                    except ValueError:
                        errors.append({
                            'row': row_num,
                            'error': f"Invalid ARR value: {row['arr']}",
                            'data': row
                        })
                        error_count += 1
                        continue

                if row.get('deal_amount'):
                    try:
                        deal_amount = float(row['deal_amount'])
                    except ValueError:
                        pass  # Optional field, ignore errors

                # Create customer
                customer = Customer(
                    workspace_id=workspace_id,
                    name=row.get('name', '').strip(),
                    domain=domain,
                    industry=row.get('industry', '').strip() or None,
                    website=row.get('website', '').strip() or None,
                    phone=row.get('phone', '').strip() or None,
                    mrr=mrr,
                    arr=arr,
                    deal_stage=row.get('deal_stage', '').strip() or None,
                    deal_amount=deal_amount
                )

                db.add(customer)
                db.flush()  # Get the ID without committing

                created_ids.append(customer.id)
                success_count += 1

            except Exception as e:
                errors.append({
                    'row': row_num,
                    'error': str(e),
                    'data': row
                })
                error_count += 1

        # Commit all successful imports
        if success_count > 0:
            db.commit()

        return CustomerImportResult(
            success_count=success_count,
            error_count=error_count,
            errors=errors,
            created_ids=created_ids
        )

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing CSV: {str(e)}"
        )


@router.get("/stats/summary")
def get_customer_stats(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get customer statistics for a workspace
    """
    total_customers = db.query(func.count(Customer.id)).filter(
        Customer.workspace_id == workspace_id,
        Customer.is_active == True
    ).scalar()

    total_arr = db.query(func.sum(Customer.arr)).filter(
        Customer.workspace_id == workspace_id,
        Customer.is_active == True,
        Customer.arr.isnot(None)
    ).scalar() or 0

    total_mrr = db.query(func.sum(Customer.mrr)).filter(
        Customer.workspace_id == workspace_id,
        Customer.is_active == True,
        Customer.mrr.isnot(None)
    ).scalar() or 0

    # Count by industry
    by_industry = db.query(
        Customer.industry,
        func.count(Customer.id).label('count')
    ).filter(
        Customer.workspace_id == workspace_id,
        Customer.is_active == True
    ).group_by(Customer.industry).all()

    return {
        'total_customers': total_customers,
        'total_arr': float(total_arr),
        'total_mrr': float(total_mrr),
        'by_industry': [
            {'industry': industry or 'Unknown', 'count': count}
            for industry, count in by_industry
        ]
    }


@router.get("/{customer_id}/consolidated", response_model=CustomerConsolidatedView)
def get_customer_consolidated_view(
    customer_id: UUID,
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get consolidated view of a customer with all related data:
    - Customer info
    - Feature requests
    - Recent messages
    - Pain points and highlights extracted from messages
    """
    from app.models.theme import Theme
    from app.schemas.customer import CustomerFeatureRequest, CustomerMessage

    # Get customer
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.workspace_id == workspace_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Get total message count
    total_messages = db.query(func.count(Message.id)).filter(
        Message.customer_id == customer.id
    ).scalar()

    # Get all messages for this customer
    messages = db.query(Message).filter(
        Message.customer_id == customer.id
    ).order_by(Message.sent_at.desc()).all()

    # Get features associated with this customer's messages
    # Use outerjoin to load themes in a single query (avoid N+1)
    features_with_themes = db.query(Feature, Theme).outerjoin(
        Theme, Feature.theme_id == Theme.id
    ).join(
        Feature.messages
    ).filter(
        Message.customer_id == customer.id
    ).distinct().all()

    # Build feature requests with theme names (already loaded, no extra queries)
    feature_requests = []
    for feature, theme in features_with_themes:
        feature_requests.append(CustomerFeatureRequest(
            id=feature.id,
            name=feature.name,
            description=feature.description,
            urgency=feature.urgency,
            status=feature.status,
            mention_count=feature.mention_count,
            first_mentioned=feature.first_mentioned,
            last_mentioned=feature.last_mentioned,
            theme_name=theme.name if theme else None
        ))

    # Get recent messages (last 10)
    recent_messages = []
    for message in messages[:10]:
        recent_messages.append(CustomerMessage(
            id=message.id,
            title=message.title,
            content=message.content[:500] if message.content else "",  # Truncate for preview
            source=message.source,
            channel_name=message.channel_name,
            author_name=message.author_name,
            sent_at=message.sent_at
        ))

    # Extract pain points from messages (keyword-based for now, fast)
    # TODO: Move LLM-based extraction to background job during ingestion
    pain_points = []

    # Simple keyword-based extraction for pain points (fast, non-blocking)
    pain_keywords = ['problem', 'issue', 'difficult', 'struggling', 'frustrated', 'bug', 'broken', 'error', 'challenge']

    for message in messages[:20]:  # Only check recent messages
        if message.content:
            content_lower = message.content.lower()
            if any(keyword in content_lower for keyword in pain_keywords):
                # Extract sentence containing pain point
                sentences = message.content.split('.')
                for sentence in sentences:
                    if any(keyword in sentence.lower() for keyword in pain_keywords):
                        pain_points.append(sentence.strip())
                        break

    # Limit to top 5 pain points
    pain_points = pain_points[:5]

    # Generate highlights
    highlights = []

    if total_messages > 0:
        highlights.append(f"{total_messages} messages/calls analyzed")

    if feature_requests:
        highlights.append(f"{len(feature_requests)} feature requests identified")
        urgent_features = [f for f in feature_requests if f.urgency in ['high', 'critical']]
        if urgent_features:
            highlights.append(f"{len(urgent_features)} high-priority requests")

    if customer.arr:
        highlights.append(f"${customer.arr:,.0f} ARR")
    elif customer.mrr:
        highlights.append(f"${customer.mrr:,.0f} MRR")

    if customer.deal_stage:
        highlights.append(f"Deal stage: {customer.deal_stage}")

    # Build customer response
    customer_dict = {
        **customer.__dict__,
        'message_count': total_messages
    }
    customer_response = CustomerResponse(**customer_dict)

    # Generate a simple summary
    summary = None
    if total_messages > 0:
        feature_count = len(feature_requests)
        summary = (
            f"{customer.name} has been very active with {total_messages} interactions. "
            f"{'They have requested ' + str(feature_count) + ' features' if feature_count > 0 else 'No specific feature requests yet'}."
        )

    return CustomerConsolidatedView(
        customer=customer_response,
        feature_requests=feature_requests,
        recent_messages=recent_messages,
        total_messages=total_messages,
        pain_points=pain_points,
        summary=summary,
        highlights=highlights
    )


@router.post("/{customer_id}/chat", response_model=CustomerChatResponse)
def customer_chat(
    customer_id: UUID,
    workspace_id: UUID,
    chat_request: CustomerChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Natural language chat interface for customer insights

    Ask questions about a customer and get AI-powered responses using:
    - Pre-built query templates for common questions (fast, reliable)
    - Text-to-SQL generation for custom queries (flexible, slower)

    Example queries:
    - "What features do they want?"
    - "Show me their urgent requests"
    - "What's their ARR?"
    - "Recent messages from last 30 days?"
    - "What are their pain points?"
    """
    # Verify customer exists and belongs to workspace
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.workspace_id == workspace_id
    ).first()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )

    # Process chat query
    chat_service = get_customer_chat_service()

    try:
        result = chat_service.chat(
            db=db,
            customer_id=str(customer_id),
            workspace_id=str(workspace_id),
            user_query=chat_request.query
        )

        return CustomerChatResponse(**result)

    except Exception as e:
        logger.error(f"Error in customer chat: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing chat query: {str(e)}"
        )
