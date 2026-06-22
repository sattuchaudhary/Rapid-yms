# 🗺️ ENTERPRISE YMS SAAS: COMPLETE PRODUCT MAP & USER ROLE BLUEPRINT
> **Document Version:** 1.0 (Production Blueprint)  
> **Target Audience:** Product Managers, Cloud Architects, Frontend/Backend Developers, and Stakeholders  
> **System Scope:** Global Multi-Tenant Yard Management Ecosystem with Zero-Downtime Architecture  

---

## 1. USER ROLES & ACCESS MATRIX (RBAC)

Is system mein **char (4) main roles** hain jo pure platform ko security, access levels, aur operational capabilities ke basis par divide karte hain.

```
       [ Super Admin ]  <-- SaaS Owner (Controls all Tenants, Subscriptions & Platforms)
              |
       [ Tenant Admin ] <-- Yard Owner (Controls one specific Yard, Staff & Financials)
              |
    +---------+---------+
    |                   |
[ Supervisor ]   [ Gate Operator / Guard ] <-- Frontline check-in, checklists & photos
```

| User Role | Dashboard Scope | Access Type | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **1. Super Admin** | Platform-Wide (Multi-tenant) | Read/Write/Bypass | Provision new Tenants, edit SaaS price subscriptions, monitor S3 Storage usage, impersonate Tenant Admins for instant troubleshooting. |
| **2. Tenant Admin** | Single Tenant Isolation | Read/Write/Manage | Setup rates (daily, hourly), view billing/revenue graphs, create Gate Operator staff accounts, generate monthly GST reports, configure notification keys. |
| **3. Yard Supervisor** | Single Tenant Isolation | Read/Edit Inventory | Allocate vehicles to specific slots/lanes, perform physical inventory audits, write check-in notes, trigger WhatsApp notifications. |
| **4. Gate Operator (Guard)** | Guard Terminal Interface | Entry/Exit Forms Only | Scan vehicle number plates, checklist inspections, capture vehicle handover photos, issue physical gate passes, process check-outs. |

---

## 2. SYSTEM-WIDE PAGE MAP & DETAILED FEATURES

### PAGE A: Global Portal Entry (Authentication & Landing)
* **Target Audience:** All User Roles
* **Route:** `/login` & `/`
* **Features:**
  1. **Dynamic Subdomain Detection:** System automatically detects the subdomain (e.g. `delhi.myyard.com`) to lock the login context to that specific Tenant ID.
  2. **Biometric & OTP MFA:** Secured multi-factor login using optional fingerprint scan or secure 6-digit email OTP codes.
  3. **Auto-Impersonate Landing:** Special gateway that handles token replacement when a Super Admin uses "Login As" from the Super Admin Console.
  4. **Password Reset Pipeline:** Fully automated secure token reset with an expiry window of 15 minutes.

---

### PAGE B: Super Admin Console (The SaaS Command Center)
* **Target Audience:** `Super Admin`
* **Route:** `/super-admin`
* **Features:**
  * **Tab 1: Platform Analytics Dashboard**
    - High-level charts tracking active tenant yards over the last 12 months.
    - S3 cloud storage audit bar (shows how many gigabytes of photos and PDF files are consumed).
    - Dynamic Monthly Recurring Revenue (MRR) based on active production accounts.
    - System health monitoring widget connected to background Redis BullMQ queues.
  * **Tab 2: Tenant Register (Yards Control)**
    - Add, edit, or provision a new parking yard (Yard Name, GST, Address, Contact Person, Plan, Limit).
    - **One-Click Suspension Toggle:** Change state to `SUSPENDED` if the tenant defaults on payments, instantly blocking their staff from checking in vehicles.
    - **Login-As (Impersonation):** Click the "Door" icon to instantly step into that specific Tenant Admin's shoes with their exact access token for live support.
  * **Tab 3: SaaS Configuration**
    - Configure subscription plan tiers (Basic, Premium, Enterprise).
    - Maintenance Mode switch (blocks platform-wide gate operations for major database migrations).
    - Global AWS S3 bucket region and SMTP mail host settings.

---

### PAGE C: Tenant Admin Dashboard (Yard HQ)
* **Target Audience:** `Tenant Admin`
* **Route:** `/dashboard`
* **Features:**
  * **Visual Metrics & KPI Cards:**
    - Live Yard Occupancy percentage (e.g., "78% Slots filled").
    - Daily gate check-ins vs check-outs.
    - Total weekly revenue, pending collections, and advance security deposit balances.
  * **Active Inventory Explorer:**
    - Dynamic search and filter system tracking vehicles by License Plate, Agent, Slot Name, or Yard Status.
    - Click-to-Action buttons to print gate passes, view captured vehicle handover pictures, or process final checkout invoices.
  * **SaaS Billing Tracker:**
    - Displays monthly platform renewal invoices, current AWS storage usage bills, and direct payment gateway portals.

---

### PAGE D: Guard Terminal (The In-Yard Gate Console)
* **Target Audience:** `Gate Operator (Guard)`, `Tenant Admin`
* **Route:** `/guard/terminal` or `/guard/check-in`
* **Features:**
  * **Check-In Wizard (Step-by-Step Form):**
    - **Step 1: Vehicle Plate & Specs:** Input Plate Number, Vehicle Maker, Agreement No, Mileage, and Place of possession.
    - **Step 2: Interactive Checklist:** Checkmarks for critical accessories (e.g., Battery, Spare Wheel, Keys, Stereo, Tools) generated dynamically from a global template.
    - **Step 3: Handover Photos Upload:** High-definition mobile image upload with automatically integrated client-side compression to prevent AWS bill explosions.
  * **Print Pass Module:**
    - Automatic PDF generation displaying QR Code for slot locations, yard rules, and check-in date-time.
  * **Check-Out Gate Portal:**
    - Insert Vehicle Plate/Ticket ID to instantly view calculated billing duration, applicable tariff slabs, and direct payment clearance check box.

---

### PAGE E: Rates & Tariff Manager
* **Target Audience:** `Tenant Admin`
* **Route:** `/rates`
* **Features:**
  1. **Tariff Slab Matrix Editor:** Add custom rates based on vehicle classes (e.g. 2-Wheeler, Sedan, SUV, Heavy Truck).
  2. **Multi-Slab Pricing Logic:** Define daily base prices, hourly charges, grace periods (e.g., "First 15 minutes are free"), and automated long-stay penalty rules.
  3. **Active/Inactive Status Toggle:** Seamlessly deprecate old rate slabs without losing past financial reference statistics.

---

### PAGE F: Settings & Crew Management
* **Target Audience:** `Tenant Admin`
* **Route:** `/settings`
* **Features:**
  1. **User/Staff Management:** Create logins for guards, assign their specific Shift times, and manage password overrides.
  2. **WhatsApp Notification API Integration:** Connect Twilio/WhatsApp API keys to automate gate pass check-in alerts directly to the vehicle owner's mobile number.

---

## 3. DATA FLOW & VEHICLE LIFECYCLE PIPELINE

```
 [Vehicle Arrives at Gate]
           |
           v
 [Guard scans & uploads checklist with compressed photos] ---> [S3 Bucket Storage]
           |
           v
 [Prisma Database Entry Created under Tenant ID]
           |
           v
 [Redis BullMQ triggers real-time WhatsApp & PDF Pass] -------> [Customer Mobile]
           |
           v
 [Vehicle parked in assigned Slot lane]
           |
           v
 [Vehicle Exits: System calculates duration and Tariff Slabs]
           |
           v
 [Final Payment cleared -> Invoice created in DB] ------------> [Digital PDF receipt sent]
```

---

## 4. ARCHITECTURAL BEST PRACTICES FOR CODING

As we expand these screens and backend microservices, developers must strictly adhere to these design principles:
1. **Tenant ID Isolation Middleware:** Every Express controller route must fetch `req.user.tenantId` from the verified JWT. Never query databases without a strict `where: { tenantId }` constraint to prevent multi-tenant cross-leaks.
2. **Atomic Financial Updates:** When checking out a vehicle and calculating billing balances, use Prisma's `$transaction` query to avoid double-entry race conditions.
3. **No Placeholders allowed:** Components must use pre-defined HSL Tailwind variables (`primary`, `slate`, `emerald`) and proper error state indicators rather than simple static templates.
