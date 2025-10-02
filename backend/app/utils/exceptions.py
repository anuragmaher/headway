"""
Custom exception classes for HeadwayHQ
"""

from fastapi import HTTPException, status


class HeadwayException(Exception):
    """Base exception class for HeadwayHQ"""
    pass


class UserNotFoundError(HeadwayException):
    """Raised when user is not found"""
    pass


class UserAlreadyExistsError(HeadwayException):
    """Raised when user already exists"""
    pass


class InvalidCredentialsError(HeadwayException):
    """Raised when login credentials are invalid"""
    pass


class InactiveUserError(HeadwayException):
    """Raised when user account is inactive"""
    pass


class OnboardingNotCompletedError(HeadwayException):
    """Raised when user has not completed onboarding"""
    pass


class WorkspaceNotFoundError(HeadwayException):
    """Raised when workspace is not found"""
    pass


class ThemeNotFoundError(HeadwayException):
    """Raised when theme is not found"""
    pass


class FeatureNotFoundError(HeadwayException):
    """Raised when feature is not found"""
    pass


class IntegrationNotFoundError(HeadwayException):
    """Raised when integration is not found"""
    pass


class InvalidTokenError(HeadwayException):
    """Raised when JWT token is invalid"""
    pass


class TokenExpiredError(HeadwayException):
    """Raised when JWT token has expired"""
    pass


# HTTP Exception factories for consistent error responses

def http_404_user_not_found() -> HTTPException:
    """HTTP 404 exception for user not found"""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found"
    )


def http_400_user_already_exists() -> HTTPException:
    """HTTP 400 exception for user already exists"""
    return HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="User with this email already exists"
    )


def http_401_invalid_credentials() -> HTTPException:
    """HTTP 401 exception for invalid credentials"""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email or password",
        headers={"WWW-Authenticate": "Bearer"}
    )


def http_401_invalid_token() -> HTTPException:
    """HTTP 401 exception for invalid token"""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"}
    )


def http_403_inactive_user() -> HTTPException:
    """HTTP 403 exception for inactive user"""
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Inactive user account"
    )


def http_403_onboarding_required() -> HTTPException:
    """HTTP 403 exception for onboarding not completed"""
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Please complete onboarding to access this resource"
    )


def http_404_workspace_not_found() -> HTTPException:
    """HTTP 404 exception for workspace not found"""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Workspace not found"
    )


def http_404_theme_not_found() -> HTTPException:
    """HTTP 404 exception for theme not found"""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Theme not found"
    )


def http_404_feature_not_found() -> HTTPException:
    """HTTP 404 exception for feature not found"""
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Feature not found"
    )