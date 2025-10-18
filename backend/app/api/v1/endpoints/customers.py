from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID
import csv
import io

from app.core.database import get_db
from app.models.customer import Customer
from app.models.message import Message
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
    CustomerListResponse,
    CustomerImportResult
)
from app.core.deps import get_current_user

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

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Customer.name.ilike(search_term)) |
            (Customer.domain.ilike(search_term))
        )

    # Get total count
    total = query.count()

    # Get paginated results
    customers = query.order_by(Customer.name).offset((page - 1) * page_size).limit(page_size).all()

    # Add message count to each customer
    customer_responses = []
    for customer in customers:
        message_count = db.query(func.count(Message.id)).filter(
            Message.customer_id == customer.id
        ).scalar()

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
