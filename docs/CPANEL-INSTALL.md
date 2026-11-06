# Chalao — cPanel-এ install করার নিয়ম (MySQL, কোনো third-party ছাড়া)

এই version-এ Supabase, Vercel বা অন্য কোনো বাইরের service লাগে না।
সব data আপনার hosting-এর **MySQL**-এ থাকে, login আপনার server-এই হয়, আর logo ইত্যাদি file আপনার hosting-এর folder-এই জমা হয়।

## আগে যা লাগবে

- cPanel-এ **Setup Node.js App** option আছে (Node **20 বা তার উপরে** select করবেন)
- cPanel-এ **MySQL® Databases** এবং **phpMyAdmin** আছে
- Domain বা subdomain, যেটাতে SSL (https) চালু

## ধাপ ১ — Database বানান

1. cPanel → **MySQL® Databases**
2. **Create New Database** → নাম দিন `chalao` → Create। (cPanel নামের আগে prefix বসাবে, যেমন `abc123_chalao`। এটা লিখে রাখুন।)
3. **MySQL Users → Add New User** → একটা username আর শক্ত password দিন (যেমন `abc123_chalao`)। Password লিখে রাখুন।
4. **Add User To Database** → এই user আর এই database বেছে নিন → **ALL PRIVILEGES** টিক দিন → Make Changes।

## ধাপ ২ — Table বানান (schema import)

1. cPanel → **phpMyAdmin**
2. বাঁ পাশে আপনার database-টা (`abc123_chalao`) ক্লিক করুন
3. উপরে **Import** → **Choose file** → zip-এর ভেতরের `database/schema.sql` দিন → নিচে **Import** চাপুন
4. "Import has been successfully finished" দেখলে ঠিক আছে। বাঁ পাশে ৩০+ টা table দেখা যাবে।

> একই file আবার import করলেও ক্ষতি নেই।

## ধাপ ৩ — App-এর file upload

1. cPanel → **File Manager** → home folder-এ যান (`/home/আপনার-cpanel-user/`)
2. **Upload** করুন `chalao-cpanel.zip`
3. Zip-এর উপর right click → **Extract**। এতে `chalao-cpanel` নামে একটা folder হবে। (এটাই application folder।)
4. Home folder-এ আরেকটা খালি folder বানান `chalao-uploads` (logo এখানে জমবে। App বদলালেও এটা মুছে যাবে না।)

## ধাপ ৪ — Node.js App চালু করুন

1. cPanel → **Setup Node.js App** → **Create Application**
2. এভাবে ভরুন:
   - **Node.js version**: 20 বা 22
   - **Application mode**: Production
   - **Application root**: `chalao-cpanel`
   - **Application URL**: আপনার domain (যেমন `app.yourdomain.com`)
   - **Application startup file**: `app.js`
3. নিচে **Environment variables** → **Add Variable** দিয়ে এগুলো একটা একটা করে দিন:

| Name | Value |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_NAME` | ধাপ ১-এর database নাম (`abc123_chalao`) |
| `DB_USER` | ধাপ ১-এর user (`abc123_chalao`) |
| `DB_PASSWORD` | ধাপ ১-এর password |
| `AUTH_SECRET` | ৩২+ অক্ষরের যেকোনো লম্বা random লেখা (একবার দিয়ে আর বদলাবেন না) |
| `SITE_URL` | `https://app.yourdomain.com` (শেষে `/` দেবেন না) |
| `ADMIN_EMAILS` | আপনার ইমেইল (যেমন `you@gmail.com`)। একাধিক হলে কমা দিয়ে |
| `UPLOAD_DIR` | `/home/আপনার-cpanel-user/chalao-uploads` |

4. **Create** চাপুন, তারপর **Restart**।
5. **"Run NPM Install" চাপবেন না।** দরকার নেই, সব library zip-এর ভেতরেই আছে।

## ধাপ ৫ — প্রথম login আর Admin

1. `SITE_URL`-এর ঠিকানা খুলুন → **Start free** → `ADMIN_EMAILS`-এ দেওয়া ইমেইল দিয়ে account খুলুন।
2. ওই ইমেইল নিজে থেকেই **Platform admin** হয়ে যায়। Dashboard-এর বাঁ মেনুতে **Platform admin** দেখা যাবে।
3. ব্যবসার নাম দিয়ে onboarding শেষ করুন।

## দরকারি কাজ

**Password ভুলে গেলে** (cPanel → Terminal, app folder-এ গিয়ে):

```
cd ~/chalao-cpanel
node admin-tool.js set-password you@gmail.com NewPassword123
```

**কাউকে Admin বানাতে**: `node admin-tool.js make-admin email@example.com`
(অথবা `ADMIN_EMAILS`-এ ইমেইল যোগ করে App Restart করুন, তারপর তিনি login করলেই হবে।)

**Backup** (সপ্তাহে অন্তত একবার):
- phpMyAdmin → database → **Export** → Quick → Go (এটাই আপনার সব data)
- File Manager-এ `chalao-uploads` folder zip করে রাখুন

**নতুন version দিলে**: `chalao-cpanel` folder-এর ভেতরের পুরনো file মুছে নতুন zip-এর file বসান, তারপর **Restart**। Database আর `chalao-uploads` ছোঁবেন না। নতুন version-এ database বদলালে আলাদা `.sql` file দেওয়া হবে, সেটা phpMyAdmin → Import করবেন।

## সমস্যা হলে

| কী হচ্ছে | কী করবেন |
|---|---|
| Site খুললে "Application error" বা 500 | **Setup Node.js App**-এ app-এর নিচে logs দেখুন। বা `chalao-cpanel/stderr.log` খুলুন। |
| "Cannot reach the database" | `DB_NAME`, `DB_USER`, `DB_PASSWORD` ঠিক আছে কিনা দেখুন। User-কে database-এ যোগ করা হয়েছে কিনা দেখুন (ধাপ ১.৪)। |
| "The database has no Chalao tables" | ধাপ ২ (schema import) বাকি আছে। |
| "AUTH_SECRET is missing" | `AUTH_SECRET` variable দিন (৩২+ অক্ষর), তারপর Restart। |
| Login হয় কিন্তু আবার login page-এ ফেরত যায় | Site `https` দিয়ে খুলুন আর `SITE_URL` `https://` দিয়ে শুরু কিনা দেখুন। |
| Logo upload হয় না | `UPLOAD_DIR` folder আছে কিনা দেখুন, আর সেটা আপনার user-এর নামে (write করা যায়)। |
| Variable বদলালাম কিন্তু কাজ হচ্ছে না | **Restart** চাপুন। |

## পুরনো Supabase data

এই version নতুন, খালি database দিয়ে শুরু হয়। আগের Supabase project-এর data এখানে আসেনি। পুরনো data দরকার হলে আলাদা করে আনতে হবে।
