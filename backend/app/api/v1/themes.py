"""
Themes API - Manages theme hierarchy (Theme -> SubTheme -> CustomerAsk)

IMPORTANT: Route ordering matters in FastAPI!
Static paths (/customer-asks, /sub-themes, /hierarchy, /reorder) MUST come
BEFORE parameterized paths (/{theme_id}) to avoid UUID parsing errors.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from uuid import UUID

from app.core.deps import get_current_user, get_db
from app.services.theme_service import ThemeService, SubThemeService, CustomerAskService
from app.schemas.theme import (
    ThemeCreate, ThemeUpdate, ThemeResponse, ThemeWithSubThemes, ThemeHierarchy,
    ThemeListResponse, SubThemeCreate, SubThemeUpdate, SubThemeResponse,
    SubThemeListResponse, SubThemeWithCustomerAsks, CustomerAskCreate,
    CustomerAskUpdate, CustomerAskResponse, CustomerAskListResponse
)
from app.schemas.mention import MentionListResponse

router = APIRouter()


# === Theme Endpoints (Static paths first) ===

@router.get("", response_model=ThemeListResponse)
async def list_themes(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List all themes for the workspace"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ThemeService(db)
    themes_with_counts = service.list_themes_with_counts(UUID(workspace_id))

    return ThemeListResponse(
        themes=[ThemeResponse(**t) for t in themes_with_counts],
        total=len(themes_with_counts)
    )


@router.get("/hierarchy", response_model=List[ThemeHierarchy])
async def get_theme_hierarchy(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get full theme hierarchy with sub-themes and customer asks"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ThemeService(db)
    hierarchy = service.get_theme_hierarchy(UUID(workspace_id))

    return [ThemeHierarchy.model_validate(t) for t in hierarchy]


@router.put("/reorder", response_model=List[ThemeResponse])
async def reorder_themes(
    theme_ids: List[UUID],
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Reorder themes"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ThemeService(db)
    themes = service.reorder_themes(UUID(workspace_id), theme_ids)

    return [ThemeResponse.model_validate(t) for t in themes]


@router.post("", response_model=ThemeResponse, status_code=status.HTTP_201_CREATED)
async def create_theme(
    data: ThemeCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new theme"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = ThemeService(db)
    theme = service.create_theme(UUID(workspace_id), data)

    return ThemeResponse.model_validate(theme)


# === SubTheme Endpoints (Static paths - /sub-themes/*) ===

@router.post("/sub-themes", response_model=SubThemeResponse, status_code=status.HTTP_201_CREATED)
async def create_sub_theme(
    data: SubThemeCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new sub-theme"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    # Verify theme exists and belongs to workspace
    theme_service = ThemeService(db)
    theme = theme_service.get_theme(data.theme_id)

    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found"
        )

    if str(theme.workspace_id) != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service = SubThemeService(db)
    sub_theme = service.create_sub_theme(UUID(workspace_id), data)

    return SubThemeResponse.model_validate(sub_theme)


@router.get("/sub-themes/{sub_theme_id}", response_model=SubThemeWithCustomerAsks)
async def get_sub_theme(
    sub_theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a sub-theme with its customer asks"""
    service = SubThemeService(db)
    sub_theme = service.get_sub_theme(sub_theme_id)

    if not sub_theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-theme not found"
        )

    if str(sub_theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return SubThemeWithCustomerAsks.model_validate(sub_theme)


@router.patch("/sub-themes/{sub_theme_id}", response_model=SubThemeResponse)
async def update_sub_theme(
    sub_theme_id: UUID,
    data: SubThemeUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a sub-theme"""
    service = SubThemeService(db)
    sub_theme = service.get_sub_theme(sub_theme_id)

    if not sub_theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-theme not found"
        )

    if str(sub_theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated = service.update_sub_theme(sub_theme_id, data)
    return SubThemeResponse.model_validate(updated)


@router.delete("/sub-themes/{sub_theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sub_theme(
    sub_theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a sub-theme"""
    service = SubThemeService(db)
    sub_theme = service.get_sub_theme(sub_theme_id)

    if not sub_theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-theme not found"
        )

    if str(sub_theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service.delete_sub_theme(sub_theme_id)


@router.post("/sub-themes/{sub_theme_id}/move", response_model=SubThemeResponse)
async def move_sub_theme(
    sub_theme_id: UUID,
    new_theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Move a sub-theme to a different theme"""
    service = SubThemeService(db)
    sub_theme = service.get_sub_theme(sub_theme_id)

    if not sub_theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-theme not found"
        )

    if str(sub_theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    moved = service.move_sub_theme(sub_theme_id, new_theme_id)
    return SubThemeResponse.model_validate(moved)


# === CustomerAsk Endpoints (Static paths - /customer-asks/*) ===

@router.get("/customer-asks", response_model=CustomerAskListResponse)
async def list_customer_asks(
    sub_theme_id: Optional[UUID] = None,
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List customer asks"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = CustomerAskService(db)
    customer_asks = service.list_customer_asks_with_message_counts(
        UUID(workspace_id),
        sub_theme_id=sub_theme_id
    )

    return CustomerAskListResponse(
        customer_asks=[CustomerAskResponse(**ca) for ca in customer_asks],
        total=len(customer_asks)
    )


@router.get("/customer-asks/search", response_model=List[CustomerAskResponse])
async def search_customer_asks(
    q: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Search customer asks"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    service = CustomerAskService(db)
    results = service.search_customer_asks(UUID(workspace_id), q, limit)

    return [CustomerAskResponse.model_validate(ca) for ca in results]


@router.post("/customer-asks", response_model=CustomerAskResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_ask(
    data: CustomerAskCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new customer ask"""
    workspace_id = current_user.get('workspace_id')
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User does not have a workspace"
        )

    # Verify sub-theme exists and belongs to workspace
    sub_theme_service = SubThemeService(db)
    sub_theme = sub_theme_service.get_sub_theme(data.sub_theme_id)

    if not sub_theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sub-theme not found"
        )

    if str(sub_theme.workspace_id) != workspace_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service = CustomerAskService(db)
    customer_ask = service.create_customer_ask(UUID(workspace_id), data)

    return CustomerAskResponse.model_validate(customer_ask)


@router.get("/customer-asks/{customer_ask_id}", response_model=CustomerAskResponse)
async def get_customer_ask(
    customer_ask_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a customer ask"""
    service = CustomerAskService(db)
    customer_ask = service.get_customer_ask(customer_ask_id)

    if not customer_ask:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ask not found"
        )

    if str(customer_ask.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return CustomerAskResponse.model_validate(customer_ask)


@router.patch("/customer-asks/{customer_ask_id}", response_model=CustomerAskResponse)
async def update_customer_ask(
    customer_ask_id: UUID,
    data: CustomerAskUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a customer ask"""
    service = CustomerAskService(db)
    customer_ask = service.get_customer_ask(customer_ask_id)

    if not customer_ask:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ask not found"
        )

    if str(customer_ask.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated = service.update_customer_ask(customer_ask_id, data)
    return CustomerAskResponse.model_validate(updated)


@router.delete("/customer-asks/{customer_ask_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer_ask(
    customer_ask_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a customer ask"""
    service = CustomerAskService(db)
    customer_ask = service.get_customer_ask(customer_ask_id)

    if not customer_ask:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ask not found"
        )

    if str(customer_ask.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service.delete_customer_ask(customer_ask_id)


@router.post("/customer-asks/{customer_ask_id}/move", response_model=CustomerAskResponse)
async def move_customer_ask(
    customer_ask_id: UUID,
    new_sub_theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Move a customer ask to a different sub-theme"""
    service = CustomerAskService(db)
    customer_ask = service.get_customer_ask(customer_ask_id)

    if not customer_ask:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ask not found"
        )

    if str(customer_ask.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    moved = service.move_customer_ask(customer_ask_id, new_sub_theme_id)
    return CustomerAskResponse.model_validate(moved)


# === Mentions Endpoints ===

@router.get("/customer-asks/{customer_ask_id}/mentions", response_model=MentionListResponse)
async def get_mentions_for_customer_ask(
    customer_ask_id: UUID,
    limit: int = 50,
    offset: int = 0,
    include_linked_asks: bool = True,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get mentions (messages) for a customer ask with AI insights.

    Returns messages linked to the customer ask along with their AI insights.
    This endpoint powers the mentions panel in the Theme Explorer.

    Query params:
    - limit: Max mentions to return (default 50)
    - offset: Pagination offset
    - include_linked_asks: If false, skips loading other linked CustomerAsks for faster response
    """
    service = CustomerAskService(db)
    customer_ask = service.get_customer_ask(customer_ask_id)

    if not customer_ask:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer ask not found"
        )

    if str(customer_ask.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    result = service.get_mentions_for_customer_ask(
        customer_ask_id=customer_ask_id,
        limit=limit,
        offset=offset,
        include_linked_asks=include_linked_asks
    )

    return MentionListResponse(**result)


# === Theme Endpoints (Parameterized paths - /{theme_id}/*) ===
# These MUST come AFTER all static paths to avoid UUID parsing errors

@router.get("/{theme_id}", response_model=ThemeWithSubThemes)
async def get_theme(
    theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a theme with its sub-themes"""
    service = ThemeService(db)
    theme = service.get_theme(theme_id)

    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found"
        )

    if str(theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    return ThemeWithSubThemes.model_validate(theme)


@router.patch("/{theme_id}", response_model=ThemeResponse)
async def update_theme(
    theme_id: UUID,
    data: ThemeUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a theme"""
    service = ThemeService(db)
    theme = service.get_theme(theme_id)

    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found"
        )

    if str(theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    updated = service.update_theme(theme_id, data)
    return ThemeResponse.model_validate(updated)


@router.delete("/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theme(
    theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a theme"""
    service = ThemeService(db)
    theme = service.get_theme(theme_id)

    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found"
        )

    if str(theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service.delete_theme(theme_id)


@router.get("/{theme_id}/sub-themes", response_model=SubThemeListResponse)
async def list_sub_themes(
    theme_id: UUID,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """List sub-themes for a theme"""
    theme_service = ThemeService(db)
    theme = theme_service.get_theme(theme_id)

    if not theme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Theme not found"
        )

    if str(theme.workspace_id) != current_user.get('workspace_id'):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    service = SubThemeService(db)
    sub_themes_with_counts = service.list_sub_themes_with_counts(theme_id)

    return SubThemeListResponse(
        sub_themes=[SubThemeResponse(**st) for st in sub_themes_with_counts],
        total=len(sub_themes_with_counts)
    )
