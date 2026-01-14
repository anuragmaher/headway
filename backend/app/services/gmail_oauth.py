import os
from google_auth_oauthlib.flow import Flow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly"
]

def gmailOauth():
    flow =  Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [os.getenv("GMAIL_REDIRECT_URI")],
            }
        },
        scopes=SCOPES
    )
    flow.redirect_uri = os.getenv("GMAIL_REDIRECT_URI")
    return flow
