export const CONST = Object.freeze({
  BASE_URL:
    process.env.NODE_ENV === 'production'
      ? 'https://api.swayauth.com/'
      : 'http://localhost:8000/',
  REDIRECT_URI_GOOGLE:
    process.env.NODE_ENV === 'production'
      ? 'https://api.swayauth.com/v1/google/response'
      : 'http://localhost:8000/v1/google/response',
  REDIRECT_URI_FACEBOOK:
    process.env.NODE_ENV === 'production'
      ? 'https://api.swayauth.com/v1/facebook/response'
      : 'http://localhost:8000/v1/facebook/response',
  SWAYAUTH_LOGO: 'https://api.swayauth.com/public/logo.png',
  PAYSTACK_BASE_URL: 'https://api.paystack.co',
  ZOHO_TOKEN_URL: 'https://accounts.zoho.com/oauth/v2/token',
  ZOHO_MAIL_URL: 'https://mail.zoho.com/api/v1/messages',
  SEND_SMS_URL: 'https://api.sendchamp.com/api/v1/sms/send',
  VERIFY_SMS_URL: 'https://api.sendchamp.com/api/v1/verification/confirm',
  CLIENT_APP_URL:
    process.env.NODE_ENV === 'production'
      ? 'https://swayauth.com'
      : 'http://localhost:3000',
  GOOGLE_OAUTH_URL:
    process.env.NODE_ENV == 'production'
      ? 'https://api.swayauth.com/v1/google/oauth?client_id='
      : 'http://localhost:8000/v1/google/oauth?client_id=',
  FACEBOOK_OAUTH_URL:
    process.env.NODE_ENV == 'production'
      ? 'https://api.swayauth.com/v1/facebook/oauth?client_id='
      : 'http://localhost:8000/v1/facebook/oauth?client_id=',
  RESPONSE: {
    PROCESSED_SUCCESSULLY: 'Request was processed successfully',
  },
  SUBSCRIPTION: {
    price: {
      free: 0,
      standard: 10000,
      premium: 30000,
    },
    free: {
      customers: 500,
      social: 0,
      organizations: 1,
      organization_tokens: 2,
      two_factor: false,
      team: 1,
      sms: 0,
      sway_email: 0,
      client_email: 0,
    },
    standard: {
      customers: 5000,
      social: 10000,
      organizations: 5,
      organization_tokens: 1000,
      two_factor: true,
      team: 6,
      sms: 1000,
      sway_email: 5000,
      client_email: 50000,
    },
    premium: {
      customers: 50000,
      social: 100000,
      organizations: 20,
      organization_tokens: 10000,
      two_factor: true,
      team: 21,
      sms: 5000,
      sway_email: 50000,
      client_email: 500000,
    },
  },
});
