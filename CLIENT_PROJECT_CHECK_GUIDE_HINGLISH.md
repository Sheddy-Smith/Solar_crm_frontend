# Malwa Solar CRM — Client Check Guide (Hinglish)

**Website:** https://poer.in  
**Purpose:** Is document se aap project check kar sakte ho — Super Admin se account banana, Sales Executive / Tele Sales Executive use karna, Lead chalana, aur Project Management dekhna.

> Baby steps me likha hai: pehle ye karo → phir ye karo.  
> Har step ke baad screen pe jo dikhe, usse match karke aage badho.

---

## 0) Pehle ye samajh lo (roles)

| Role | Kaam kya hai |
|------|----------------|
| **Super Admin** | Sab control. Naye users banata hai, roles/branch deta hai, leads assign karta hai |
| **Sales Executive** | Apne assigned leads dekhna, follow-up, status (rules ke hisaab se) |
| **Tele Sales Executive** | Alag **Tele Portal** — telecalling / tele leads |
| **Branch Manager / Admin** | Team manage, leads assign (jab account diya ho) |

**Do alag portals hain:**

1. **CRM Operations** — normal CRM (Lead, Project, Settings, Accounts…)  
2. **Tele Executive** — sirf Tele Sales Executive ke liye

Login page pe pehle portal choose karna padta hai.

---

## 1) Super Admin se login kaise karein

### Step 1.1 — Site kholo
1. Browser me jao: **https://poer.in**
2. Agar pehle se koi user login hai to **Logout** kar do (sidebar / profile se)

### Step 1.2 — Portal select
1. Screen pe portal options dikhenge  
2. **CRM Operations** choose karo (Sales / Super Admin / normal CRM ke liye)  
3. Tele wale ke liye baad me **Tele Executive** choose karenge

### Step 1.3 — Super Admin login
Demo / check ke liye (abhi live pe set hai):

| Field | Value |
|-------|--------|
| Email | `Ecomalwa@poer.in` |
| Password | `M@lw@_822` |

1. Email + Password daalo  
2. **Sign In / Login** dabao  
3. Left sidebar dikhna chahiye: Dashboard, Lead, Project Management, Settings, etc.

> Password change karna ho to baad me Settings se change kar sakte ho. Client check ke baad strong password rakhna best hai.

---

## 2) Super Admin se naya account kaise banaye

Yahi se aap **Sales Executive**, **Tele Sales Executive**, ya koi aur user banaoge.

### Step 2.1 — Users page kholo
1. Left sidebar me **Settings** pe click  
2. (Pehli baar Admin verification maange to Super Admin ka **password** dubara daalna pad sakta hai)  
3. **User & Access Management → Users** / **Users List** pe jao  
4. Page title: **Users List** dikhna chahiye

### Step 2.2 — Add New User
1. Right side pe **+ Add New User** button dabao  
2. Form khulega: **Add New User**

### Step 2.3 — Form fill karo (baby steps)

| Field | Kya likho | Example |
|-------|-----------|---------|
| **User Name** | Poora naam | `Rahul Sharma` |
| **Email** | Valid email (`naam@domain.com`) | `rahul@malwa.in` |
| **Phone Number** | 10 digit (optional but better) | `9876543210` |
| **Role** | Dropdown se role choose | `Sales Executive` ya `Tele Sales Executive` |
| **Branch** | Branch choose | `Head Office` / jo available ho |
| **Status** | Active rakho | `Active` |
| **Password** | Minimum 8 characters | `Rahul@1234` |
| **Confirm Password** | Same password dubara | `Rahul@1234` |

**Email rules (important):**
- Format: `something@domain.com`  
- Galat: `name@.gmail.com` (`@` ke baad seedha `.`)  
- Galat: sirf `malwa.in` (`@` missing)  
- Sahi: `shoaibm@lwa.in` / `rahul@gmail.com`

### Step 2.4 — Save
1. **Save User** dabao  
2. Success toast aana chahiye (jaise “Rahul Sharma added”)  
3. Users List me naya user dikhna chahiye

### Step 2.5 — Galati aaye to
- **Enter a valid email address** → email format theek karo  
- **Passwords do not match** → dono password same rakho  
- **Password must be at least 8 characters** → 8+ characters  
- Email already exists → dusra email use karo

---

## 3) Sales Executive account — kaise banao + kaise use karo

### 3A) Super Admin se Sales Executive banayo

1. Section **2** follow karo  
2. Role dropdown me **Sales Executive** select karo  
3. Branch do, password set karo, **Save User**

**Demo accounts (agar pehle se bane hain):**

| User | Email | Password |
|------|-------|----------|
| Sales Executive 1 | `sales1@poer.in` | `Sales1@822` |
| Sales Executive 2 | `sales2@poer.in` | `Sales2@822` |

### 3B) Sales Executive se login
1. Super Admin se **Logout**  
2. https://poer.in → **CRM Operations**  
3. Sales Executive ka email + password daalo  
4. Login ke baad sidebar me limited modules dikhenge (role ke hisaab se)

### 3C) Sales Executive Lead kaise dekhe / use kare
1. Sidebar → **Lead** → **Lead List**  
2. Is role ko mostly **apne assigned** leads dikhte hain  
3. Lead pe click → **Lead Details**  
4. Follow-up / notes / status (jo permission allow kare)  
5. **Important:** Sales Executive usually:
   - Lead **assign** nahi karta (ye Manager/Super Admin karta hai)  
   - Status change / delete pe restrictions ho sakti hain  
   - Won lead delete Manager/Super Admin level pe hi

### 3D) Super Admin lead ko Sales Executive ko assign kaise kare
1. Super Admin se login  
2. **Lead → Lead List**  
3. Jis lead ko dena hai us row me **Assign** (users icon / assign action)  
4. Sales Executive select karo → Assign / Save  
5. Ab us Sales Executive se login karke Lead List me woh lead dikhni chahiye

---

## 4) Tele Sales Executive — account + portal kaise use karein

Tele wala CRM Operations se **alag portal** hai.

### 4A) Super Admin se Tele account banayo
1. Settings → Users → **Add New User**  
2. Role: **Tele Sales Executive** (name exact hona chahiye)  
3. Email, password, branch, **Active**  
4. **Save User**

**Demo Tele account (agar set hai):**

| Field | Value |
|-------|--------|
| Email | `ridwan786@gmail.com` |
| Password | `ridwan@786` |

### 4B) Tele portal login
1. Logout (agar CRM me ho)  
2. https://poer.in  
3. Portal select: **Tele Executive** (CRM Operations mat choose karo)  
4. Tele email + password se login  
5. Tele dashboard / leads / follow-up screens dikhenge

### 4C) Tele se basic use
1. Tele lead list dekho  
2. Nayi tele lead add (agar button available ho)  
3. Follow-up log / timeline update karo  
4. Lead status / next call note update karo  

> Agar login ke baad “wrong portal / role” jaisa lage to Role name confirm karo: **Tele Sales Executive**  
> CRM Operations me Tele role se full CRM nahi chalega — Tele portal use karo.

---

## 5) Lead module — Super Admin / Manager flow (step by step)

### Step 5.1 — Lead List kholo
1. CRM Operations me login (Super Admin)  
2. Sidebar → **Lead** → **Lead List**

### Step 5.2 — Naya Lead banao
1. **+ Create Lead / Add Lead** (jo button dikhe) dabao  
2. Customer name, mobile, source, city / required fields bharo  
3. Save  
4. Lead List me naya lead dikhna chahiye

### Step 5.3 — Lead Details
1. Lead List se lead pe click  
2. Details, status, notes, follow-up options dekho  
3. Follow-up schedule / note add karke save karo

### Step 5.4 — Lead Assign (Sales Executive ko)
1. Lead List → Assign action  
2. Executive choose  
3. Confirm  
4. Filter se “All Executives” / us executive se check karo

### Step 5.5 — Status update
1. Lead Details / status action se status badlo (jaise Contacted, Quotation, Won…)  
2. Sales Executive pe status lock ho sakta hai — Super Admin/Manager se check karo

### Step 5.6 — Client check checklist (Lead)
- [ ] Lead create hota hai  
- [ ] Lead list me dikhta hai  
- [ ] Assign Sales Executive ko hota hai  
- [ ] Sales Executive sirf apni lead dekhta hai  
- [ ] Follow-up / note save hota hai  

---

## 6) Project Management — kaise check karein

Lead ke baad jab project stage aata hai, **Project Management** use hota hai.

### Step 6.1 — Module kholo
1. Super Admin (ya jisko Project access ho) se login  
2. Sidebar → **Project Management**  
3. Submenu / list: projects, overview, etc. dikhenge

### Step 6.2 — Project list / overview
1. Existing projects list dekho  
2. Ek project pe click → details / timeline / work related tabs  
3. Documents / approvals / related sections (agar menu me ho) open karke dekho

### Step 6.3 — Client check checklist (Project)
- [ ] Project Management sidebar se open hota hai  
- [ ] Project list load hoti hai  
- [ ] Project detail page khulti hai  
- [ ] Related tabs (timeline / docs / etc.) open hote hain  

> Agar list empty ho to pehle system me sample project / won lead se project flow complete karna pad sakta hai. Super Admin se koi existing project open karke UI check kar sakte ho.

---

## 7) Poora flow ek nazar me (client demo script)

Is order me chalao — client ke saamne easy lagega:

### Part A — Super Admin setup (10 min)
1. https://poer.in → CRM Operations → Super Admin login  
2. Settings → Users → Add New User  
3. Ek **Sales Executive** banao  
4. Ek **Tele Sales Executive** banao  
5. Users List me dono dikhne chahiye

### Part B — Lead + Assign (10 min)
1. Super Admin → Lead List → Create Lead  
2. Us lead ko naye Sales Executive ko Assign karo  
3. Logout

### Part C — Sales Executive check (5–7 min)
1. CRM Operations → Sales Executive login  
2. Lead List → assigned lead dikhni chahiye  
3. Lead open → detail / follow-up try karo  
4. Logout

### Part D — Tele check (5–7 min)
1. Portal → **Tele Executive**  
2. Tele account login  
3. Tele leads / follow-up screen check  
4. Logout

### Part E — Project Management (5 min)
1. Super Admin se CRM login  
2. Project Management open  
3. List + ek project detail check  

---

## 8) Common problems (quick fix)

| Problem | Kya check karo |
|---------|----------------|
| Login fail | Portal sahi hai? (CRM vs Tele). Email/password exact? |
| Tele login CRM me nahi chal raha | Tele portal choose karo; Role = Tele Sales Executive |
| Email invalid | `name@domain.com` format; `@.` mat likho |
| Sales Exec ko lead nahi dikhti | Super Admin ne assign kiya? Status Active? |
| Add User pe role empty | Thoda wait / page refresh; roles load hone do |
| Password error | Min 8 characters; Confirm same |

---

## 9) Important notes for client

1. **Super Admin** sabse powerful hai — user create / assign yahi se.  
2. **Sales Executive** = CRM Operations portal.  
3. **Tele Sales Executive** = Tele Executive portal (alag).  
4. Email hamesha valid format me do.  
5. Check ke baad demo passwords change kar dena better hai.  
6. Live URL: **https://poer.in**

---

## 10) Quick copy — demo logins

| Role | Portal | Email | Password |
|------|--------|-------|----------|
| Super Admin | CRM Operations | `Ecomalwa@poer.in` | `M@lw@_822` |
| Sales Executive 1 | CRM Operations | `sales1@poer.in` | `Sales1@822` |
| Sales Executive 2 | CRM Operations | `sales2@poer.in` | `Sales2@822` |
| Tele Sales Executive | Tele Executive | `ridwan786@gmail.com` | `ridwan@786` |

---

**Document end.**  
Agar kisi step pe screen alag dikhe to screenshot leke team ko bhej dena — usi step number ke saath (jaise “Step 2.3 pe Role dropdown empty”).
