from typing import Optional, List
from sqlmodel import Session, select
from .base import CRUDBase
from ..models import Plan, Tenant, AdminUser, Locale
from ..schemas import (
    PlanCreate, PlanUpdate,
    TenantCreate, TenantUpdate,
    AdminUserCreate, AdminUserUpdate,
    LocaleCreate, LocaleUpdate
)
from ..core.security import get_password_hash, verify_password
from fastapi import HTTPException


class CRUDPlan(CRUDBase[Plan, PlanCreate, PlanUpdate]):
    def get_by_code(self, db: Session, *, code: str) -> Optional[Plan]:
        """Get plan by code"""
        return db.exec(select(Plan).where(Plan.code == code)).first()


class CRUDTenant(CRUDBase[Tenant, TenantCreate, TenantUpdate]):
    def get_by_code(self, db: Session, *, code: str) -> Optional[Tenant]:
        """Get tenant by code"""
        return db.exec(select(Tenant).where(Tenant.code == code)).first()
    
    def get_active(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[Tenant]:
        """Get active tenants"""
        return db.exec(
            select(Tenant).where(Tenant.is_active == True).offset(skip).limit(limit)
        ).all()


class CRUDAdminUser(CRUDBase[AdminUser, AdminUserCreate, AdminUserUpdate]):
    def get_by_email(self, db: Session, *, email: str, tenant_id: Optional[int] = None) -> Optional[AdminUser]:
        """Get user by email"""
        query = select(AdminUser).where(AdminUser.email == email)
        if tenant_id is not None:
            query = query.where(AdminUser.tenant_id == tenant_id)
        return db.exec(query).first()

    def create(self, db: Session, *, obj_in: AdminUserCreate) -> AdminUser:
        """Create user with hashed password"""
        # Check if email already exists in tenant
        existing_user = self.get_by_email(db, email=obj_in.email, tenant_id=obj_in.tenant_id)
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this email already exists in this tenant"
            )
        
        db_obj = AdminUser(
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            full_name=obj_in.full_name,
            role=obj_in.role,
            tenant_id=obj_in.tenant_id,
            # service_access: Removed - restaurant-only
            is_active=True
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def authenticate(self, db: Session, *, email: str, password: str, tenant_id: Optional[int] = None) -> Optional[AdminUser]:
        """Authenticate user"""
        user = self.get_by_email(db, email=email, tenant_id=tenant_id)
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def update_password(self, db: Session, *, user: AdminUser, new_password: str) -> AdminUser:
        """Update user password"""
        user.password_hash = get_password_hash(new_password)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def get_active_users(self, db: Session, *, tenant_id: int, skip: int = 0, limit: int = 100) -> List[AdminUser]:
        """Get active users in a tenant"""
        return db.exec(
            select(AdminUser)
            .where(AdminUser.tenant_id == tenant_id)
            .where(AdminUser.is_active == True)
            .offset(skip)
            .limit(limit)
        ).all()

    def get_by_role(self, db: Session, *, tenant_id: int, role: str) -> List[AdminUser]:
        """Get users by role in a tenant"""
        return db.exec(
            select(AdminUser)
            .where(AdminUser.tenant_id == tenant_id)
            .where(AdminUser.role == role)
        ).all()


class CRUDLocale(CRUDBase[Locale, LocaleCreate, LocaleUpdate]):
    def get_by_code(self, db: Session, *, code: str) -> Optional[Locale]:
        """Get locale by code"""
        return db.exec(select(Locale).where(Locale.code == code)).first()


# Create instances
plan = CRUDPlan(Plan)
tenant = CRUDTenant(Tenant)
admin_user = CRUDAdminUser(AdminUser)
locale = CRUDLocale(Locale)
