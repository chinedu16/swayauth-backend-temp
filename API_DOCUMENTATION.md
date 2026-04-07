# SwayAuth API Documentation

This document provides a comprehensive list of all API endpoints, their descriptions, and the payloads they use.

## **Base URL**
`v1/`

---

## **1. Authentication**
**Base Path:** `auth/`

### **Facebook Consent Screen**
- **Method:** `GET`
- **Path:** `facebook`
- **Description:** Renders the Facebook OAuth consent screen.
- **Query Params:**
  - `client_id` (string, required)
  - `alert` (enum: `on`, `off`, default: `on`)

### **Google Consent Screen**
- **Method:** `GET`
- **Path:** `google`
- **Description:** Renders the Google OAuth consent screen.
- **Query Params:**
  - `client_id` (string, required)
  - `alert` (enum: `on`, `off`, default: `on`)

### **User Login**
- **Method:** `POST`
- **Path:** `login/user`
- **Description:** Authenticates a user within an organization.
- **Payload (Body):**
  - `email` (string, required, email)
  - `password` (string, required, min 6 chars)

### **Client Login**
- **Method:** `POST`
- **Path:** `login/client`
- **Description:** Authenticates a client (organization owner).
- **Payload (Body):**
  - `email` (string, required, email)
  - `password` (string, required, min 6 chars)

### **Admin Login**
- **Method:** `POST`
- **Path:** `login/admin`
- **Description:** Authenticates an admin user.
- **Payload (Body):**
  - `email` (string, required, email)
  - `password` (string, required, min 6 chars)

### **User Registration**
- **Method:** `POST`
- **Path:** `register/user`
- **Description:** Registers a new user within an organization.
- **Payload (Body):**
  - `email` (string, required, email)
  - `password` (string, required, min 6 chars)
  - `first_name` (string, optional)
  - `last_name` (string, optional)
  - `phone` (string, optional, phone number)
  - `address` (string, optional)
  - `city` (string, optional)
  - `state` (string, optional)
  - `country` (string, optional)
  - `photo` (string, optional)

### **Resend Registration Code (User)**
- **Method:** `POST`
- **Path:** `register/resend-code`
- **Description:** Resends the verification code for user registration.
- **Payload (Body):**
  - `email` (string, required, email)

### **Client Registration**
- **Method:** `POST`
- **Path:** `register/client`
- **Description:** Registers a new client (organization owner).
- **Payload (Body):**
  - `email` (string, required, email)
  - `password` (string, required, min 6 chars)
  - `company_name` (string, optional)
  - (Includes all other fields from User Registration)

### **Resend Registration Code (Client)**
- **Method:** `POST`
- **Path:** `register/resend-client-code`
- **Description:** Resends the verification code for client registration.
- **Payload (Body):**
  - `email` (string, required, email)

### **Verify Registration**
- **Method:** `POST`
- **Path:** `register/verify`
- **Description:** Verifies the registration code.
- **Payload (Body):**
  - `token` (string, required, 6 digits)
  - `reference` (string, required)
  - `password` (string, optional, min 6 chars)

### **Forgot Password (User)**
- **Method:** `POST`
- **Path:** `forgot-password/user`
- **Description:** Initiates the forgot password process for a user.
- **Payload (Body):**
  - `email` (string, required, email)

### **Forgot Password (Client)**
- **Method:** `POST`
- **Path:** `forgot-password/client`
- **Description:** Initiates the forgot password process for a client.
- **Payload (Body):**
  - `email` (string, required, email)

### **Verify Reset Token**
- **Method:** `GET`
- **Path:** `token/verify`
- **Description:** Verifies the password reset token.
- **Query Params:**
  - `token` (string, required, 6 digits)
  - `reference` (string, required)

### **Reset Password**
- **Method:** `PATCH`
- **Path:** `forgot-password/new-password`
- **Description:** Sets a new password after verification.
- **Payload (Body):**
  - `token` (string, required, 6 digits)
  - `reference` (string, required)
  - `password` (string, required, min 6 chars)

### **2FA Methods List**
- **Method:** `GET`
- **Path:** `2fa/list`
- **Description:** Returns the allowed 2FA methods for the authenticated user.
- **Auth:** `UserGuard`

### **Enable 2FA**
- **Method:** `POST`
- **Path:** `2fa/enable`
- **Description:** Enables 2FA for the user.
- **Payload (Body):**
  - `type` (enum: `app`, `email`, `sms`, `none`)
- **Auth:** `UserGuard`

### **Verify 2FA**
- **Method:** `POST`
- **Path:** `2fa/verify`
- **Description:** Verifies the 2FA token.
- **Payload (Body):**
  - `token` (string, required, 6 digits)
  - `reference` (string, required)

---

## **2. Account Management**
**Base Path:** `account/`

### **Get Profile**
- **Method:** `GET`
- **Path:** `/`
- **Description:** Retrieves the profile of the authenticated user.
- **Auth:** `UserGuard`

### **Edit User Profile**
- **Method:** `PATCH`
- **Path:** `/`
- **Description:** Updates the authenticated user's profile.
- **Payload (Body):**
  - `first_name` (string, optional)
  - `last_name` (string, optional)
  - `phone` (string, optional)
  - `address` (string, optional)
  - `city` (string, optional)
  - `state` (string, optional)
  - `country` (string, optional)
  - `photo` (string, optional)
  - `company_name` (string, optional)
  - `company_bio` (string, optional)
- **Auth:** `UserGuard`

### **Change User Photo**
- **Method:** `PATCH`
- **Path:** `photo`
- **Description:** Updates the user's profile photo.
- **Payload (File):** Image file
- **Auth:** `UserGuard`

### **Edit User Password**
- **Method:** `PATCH`
- **Path:** `password`
- **Description:** Updates the authenticated user's password.
- **Payload (Body):**
  - `old_password` (string, required, min 6 chars)
  - `new_password` (string, required, min 6 chars)
- **Auth:** `UserGuard`

### **Switch Client Account**
- **Method:** `PUT`
- **Path:** `switch/:id`
- **Description:** Switches the client account to a different organization.
- **Auth:** `ClientGuard`

### **Get Associated Accounts**
- **Method:** `GET`
- **Path:** `association`
- **Description:** Retrieves accounts associated with the client.
- **Auth:** `ClientGuard`

### **Get Company Profile**
- **Method:** `GET`
- **Path:** `company`
- **Description:** Retrieves the company profile.
- **Auth:** `CompanyGuard`

### **Edit Company Profile**
- **Method:** `PATCH`
- **Path:** `company`
- **Description:** Updates the company profile.
- **Payload (Body):**
  - `name` (string, optional)
  - `address` (string, optional)
  - `city` (string, optional)
  - `state` (string, optional)
  - `country` (string, optional)
- **Auth:** `CompanyGuard`, `PermissionGuard('write')`, `AccessGuard(['level_3'])`

---

## **3. User Management**
**Base Path:** `users/`

### **Get Current User**
- **Method:** `GET`
- **Path:** `me`
- **Description:** Retrieves the current authenticated user's information.
- **Auth:** `UserGuard`, `PermissionGuard('write')`

---

## **4. Client/Company Management**
**Base Path:** `client/`

### **4.1 Organizations**
**Path:** `client/organizations/`

- **GET `/`**: List organizations.
- **POST `create`**: Create a new organization.
- **DELETE `tokens`**: Delete organization tokens.
- **PATCH `tokens/:id`**: Edit an organization token.
- **PATCH `:id/photo`**: Change organization photo.
- **GET `:id/tokens`**: List tokens for a specific organization.
- **POST `:id/tokens`**: Create a token for a specific organization.
- **GET `:id`**: Get organization details.
- **PATCH `:id`**: Edit organization details.
- **DELETE `:id`**: Delete organization.

### **4.2 Wallet**
**Path:** `client/wallet/`

- **GET `balance`**: Get wallet balance.
- **POST `init-payment`**: Initiate wallet funding.
- **GET `card-payment/:id`**: Process card payment.

### **4.3 Users**
**Path:** `client/users/`

- **GET `/`**: List users in the company.
- **GET `statistics`**: Get user statistics.
- **PUT `activate`**: Activate users.
- **PUT `deactivate`**: Deactivate users.
- **DELETE `delete/:id`**: Delete a user.

### **4.4 Team**
**Path:** `client/team/`

- **GET `/`**: List team members.
- **POST `create`**: Add a team member.
- **DELETE `:id`**: Remove a team member.
- **PATCH `permission/:id`**: Change team member permissions.

---

## **5. Admin Management**
**Base Path:** `admin/`

### **5.1 Clients**
**Path:** `admin/clients/`

- **GET `/`**: List all clients.
- **PUT `activate`**: Activate clients.
- **PUT `deactivate`**: Deactivate clients.
- **DELETE `delete/:id`**: Delete a client.
- **GET `:id`**: Get client details.

### **5.2 Organizations**
**Path:** `admin/organizations/`

- **GET `:id/tokens`**: Get organization tokens.
- **GET `:id/users`**: Get organization user list.
- **GET `:id`**: Get organization details.

### **5.3 Statistics**
**Path:** `admin/statistics/`

- **GET `count`**: Get general statistics counts.
- **GET `clients`**: Get client growth statistics.
- **GET `integration`**: Get integration statistics.
- **GET `recent-clients`**: Get list of recent clients.

### **5.4 Team**
**Path:** `admin/team/`

- **GET `/`**: List admin team members.
- **GET `count`**: Get admin team count.
- **POST `create`**: Add an admin team member.
- **PUT `activate`**: Activate admin team member.
- **PUT `deactivate`**: Deactivate admin team member.
- **DELETE `delete/:id`**: Delete admin team member.
- **PATCH `permission/:id`**: Change admin team member permissions.

---

## **6. Blog**
**Base Path:** `blog/`

- **GET `/`**: List blogs.
- **GET `count`**: Get blog counts.
- **POST `create`**: Create a blog post (Admin only).
- **DELETE `delete/:id`**: Delete a blog post (Admin only).
- **PUT `:id`**: Edit a blog post (Admin only).
- **GET `:url`**: Get a blog post by URL.

---

## **7. Subscription**
**Base Path:** `subscription/`

- **GET `/`**: Get current company subscription.
- **POST `newsletter`**: Subscribe to newsletter.
- **POST `upgrade`**: Upgrade subscription plan.

---

## **8. Social Authentication (Internal)**
- **Google Auth:** `google/oauth` (GET), `google/response` (GET)
- **Facebook Auth:** `facebook/oauth` (GET), `facebook/response` (GET)

---

## **9. Miscellaneous**
- **Upload Image:** `POST upload/image` (Auth: `UserOrSwayGuard`)
- **Payment Hook:** `POST payment/hook` (Webhook from Paystack)
