from typing import Any, List

from fastapi import APIRouter, HTTPException

from app import crud
from app.api.deps import CurrentUser, SessionDep, TenantUser
from app.models import AdminUser
from app.models.activity_log import ActivityType
from app.utils.activity_logger import log_activity
from app.schemas import (
    AdminUserCreate, AdminUserResponse, AdminUserUpdate, 
    AdminUserPasswordUpdate
)

router = APIRouter()


@router.get("/me", response_model=AdminUserResponse)
def read_user_me(current_user: CurrentUser) -> Any:
    """
    Get current user.
    """
    return current_user


@router.put("/me", response_model=AdminUserResponse)
def update_user_me(
    *,
    session: SessionDep,
    user_in: AdminUserUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update own user.
    """
    user = crud.admin_user.update(session, db_obj=current_user, obj_in=user_in)
    return user


@router.put("/me/password")
def update_password_me(
    *,
    session: SessionDep,
    body: AdminUserPasswordUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update own password.
    """
    if not crud.admin_user.authenticate(
        session, email=current_user.email, password=body.current_password, tenant_id=current_user.tenant_id
    ):
        raise HTTPException(status_code=400, detail="Incorrect password")
    
    crud.admin_user.update_password(session, user=current_user, new_password=body.new_password)
    return {"message": "Password updated successfully"}


@router.patch("/me/password")
def update_password_me_patch(
    *,
    session: SessionDep,
    body: AdminUserPasswordUpdate,
    current_user: CurrentUser,
) -> Any:
    """
    Update own password (PATCH method).
    """
    if not crud.admin_user.authenticate(
        session, email=current_user.email, password=body.current_password, tenant_id=current_user.tenant_id
    ):
        raise HTTPException(status_code=400, detail="Incorrect password")
    
    crud.admin_user.update_password(session, user=current_user, new_password=body.new_password)
    return {"message": "Password updated successfully"}


@router.get("/", response_model=List[AdminUserResponse])
def read_users(
    session: SessionDep,
    current_user: TenantUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Retrieve users in tenant. Requires admin or owner role.
    """
    # Check if user has permission to list users (case-insensitive)
    if current_user.role.lower() not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    users = crud.admin_user.get_multi(session, skip=skip, limit=limit, tenant_id=current_user.tenant_id)
    return users


@router.post("/", response_model=AdminUserResponse)
def create_user(
    *,
    session: SessionDep,
    current_user: TenantUser,
    user_in: AdminUserCreate,
) -> Any:
    """
    Create new user in tenant. Requires admin or owner role.
    """
    # Check if user has permission to create users (case-insensitive)
    current_role = current_user.role.lower()
    if current_role not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Admins can only create editors and viewers (not owners or other admins)
    new_user_role = user_in.role.lower() if user_in.role else "editor"
    if current_role == "admin" and new_user_role not in ["editor", "viewer"]:
        raise HTTPException(status_code=403, detail="Admins can only create editors and viewers")
    
    # Ensure the user is being created in the correct tenant
    user_in.tenant_id = current_user.tenant_id
    
    # Auto-sync service_access: removed for restaurant-only system.
    # All users have access to Restaurant by default.
    
    user = crud.admin_user.create(session, obj_in=user_in)
    
    # Log activity
    log_activity(
        db=session,
        tenant_id=current_user.tenant_id,
        activity_type=ActivityType.CREATE_USER,
        details={
            "message": f"User '{user.email}' created by {current_user.email}",
            "user_id": current_user.id,
            "username": current_user.email,
            "created_user_id": user.id,
            "created_user_email": user.email
        }
    )
    
    return user


@router.put("/{user_id}", response_model=AdminUserResponse)
def update_user(
    *,
    session: SessionDep,
    current_user: TenantUser,
    user_id: int,
    user_in: AdminUserUpdate,
) -> Any:
    """
    Update a user. Requires admin or owner role.
    """
    # Check if user has permission to update users (case-insensitive)
    if current_user.role.lower() not in ["owner", "admin"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    user = crud.admin_user.get(session, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Ensure user belongs to the same tenant
    if user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="User not in this tenant")
    
    # Permission checks (case-insensitive)
    current_role = current_user.role.lower()
    target_role = user.role.lower()
    
    # Non-owners cannot modify owner users
    if current_role != "owner" and target_role == "owner":
        raise HTTPException(status_code=403, detail="Cannot modify owner user")
    
    # Admins can only modify editors and viewers (not other admins or owners)
    if current_role == "admin" and target_role not in ["editor", "viewer"]:
        raise HTTPException(status_code=403, detail="Admins can only modify editors and viewers")
    
    user = crud.admin_user.update(session, db_obj=user, obj_in=user_in)
    
    # Log activity
    log_activity(
        db=session,
        tenant_id=current_user.tenant_id,
        activity_type=ActivityType.UPDATE_USER,
        details={
            "message": f"User '{user.email}' updated by {current_user.email}",
            "user_id": current_user.id,
            "username": current_user.email,
            "updated_user_id": user.id,
            "updated_user_email": user.email
        }
    )
    
    return user


@router.get("/{user_id}", response_model=AdminUserResponse)
def read_user(
    user_id: int,
    session: SessionDep,
    current_user: TenantUser,
) -> Any:
    """
    Get a specific user by id.
    """
    user = crud.admin_user.get(session, id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Ensure user belongs to the same tenant
    if user.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=403, detail="User not in this tenant")
    
    # Users can only see themselves unless they are admin/owner (case-insensitive)
    if current_user.role.lower() not in ["owner", "admin"] and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return user


@router.delete("/{user_id}")
def delete_user(
    *,
    session: SessionDep,
    current_user: TenantUser,
    user_id: int,
) -> Any:
    """
    Delete a user. Owners can delete anyone. Admins can delete editors and viewers.
    """
    print(f"🗑️ DELETE USER: current_user_role={current_user.role.lower()}, current_user_tenant_id={current_user.tenant_id}, current_user_tenant_id={current_user.tenant_id}")
    
    # Get target user first to check their role
    user = crud.admin_user.get(session, id=user_id)
    if not user:
        print(f"❌ DELETE USER: User {user_id} not found")
        raise HTTPException(status_code=404, detail="User not found")
    
    print(f"🗑️ DELETE USER: target_user_id={user_id}, target_user_role={user.role.lower()}, target_user_tenant_id={user.tenant_id}")
    
    user_email = user.email  # Save before deletion
    
    # Permission check (case-insensitive)
    current_role = current_user.role.lower()
    target_role = user.role.lower()
    
    # OWNER can delete anyone except other owners
    if current_role == "owner":
        if target_role == "owner":
            print(f"❌ DELETE USER: Cannot delete another owner")
            raise HTTPException(status_code=403, detail="Cannot delete another owner")
    # ADMIN can only delete editors and viewers
    elif current_role == "admin":
        if target_role not in ["editor", "viewer"]:
            print(f"❌ DELETE USER: Admin cannot delete {target_role}")
            raise HTTPException(status_code=403, detail=f"Admins can only delete editors and viewers, not {target_role}")
    # Other roles cannot delete
    else:
        print(f"❌ DELETE USER: Role check failed - {current_role} cannot delete users")
        raise HTTPException(status_code=403, detail="Only owners and admins can delete users")
    
    # Ensure user belongs to the same tenant
    if user.tenant_id != current_user.tenant_id:
        print(f"❌ DELETE USER: Tenant mismatch - target_user_tenant_id={user.tenant_id} != current_user_tenant_id={current_user.tenant_id}")
        raise HTTPException(status_code=403, detail="User not in this tenant")
    
    # Cannot delete yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    crud.admin_user.remove(session, id=user_id)
    
    # Log activity
    log_activity(
        db=session,
        tenant_id=current_user.tenant_id,
        activity_type=ActivityType.DELETE_USER,
        details={
            "message": f"User '{user_email}' deleted by {current_user.email}",
            "user_id": current_user.id,
            "username": current_user.email,
            "deleted_user_id": user_id,
            "deleted_user_email": user_email
        }
    )
    
    return {"message": "User deleted successfully"}


