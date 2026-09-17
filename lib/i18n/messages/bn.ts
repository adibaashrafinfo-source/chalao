import { en, type Messages } from "./en";

// Marketing copy is Bangla-first; product terms sellers already use (Order, Courier, COD) stay English.
// Namespaces not yet translated (auth, validation) fall back to English via the spread.
export const bn: Messages = {
  ...en,

  marketing: {
    meta: {
      title: "Chalao — Order থেকে COD, এক dashboard-এ",
      description:
        "Facebook ও Instagram seller-দের জন্য orders, customers, inventory, couriers, COD আর profit — এক dashboard থেকে।",
    },
    nav: en.marketing.nav,
    hero: {
      eyebrow: "Facebook ও Instagram seller-দের জন্য তৈরি",
      titleBefore: "Facebook Orders থেকে Delivery পর্যন্ত সবকিছু ",
      titleHighlight: "এক জায়গায়",
      titleAfter: " ম্যানেজ করুন",
      subtitle: en.marketing.hero.subtitle,
      note: "Credit card লাগবে না",
      previewLabel: "Chalao dashboard-এর preview, নমুনা data দিয়ে দেখানো",
    },
    lifecycle: {
      eyebrow: "How it works",
      title: "Lead থেকে Profit — পুরো order journey এক flow-তে",
      description: "Customer-এর প্রথম message থেকে টাকা হাতে আসা পর্যন্ত প্রতিটি ধাপ track হয়, কিছুই হারিয়ে যায় না।",
      steps: [
        { label: "Lead", caption: "Inbox-এর inquiry" },
        { label: "Order", caption: "Order তৈরি" },
        { label: "Confirmation", caption: "Phone-এ confirm" },
        { label: "Inventory", caption: "Stock আপডেট" },
        { label: "Courier", caption: "Parcel booking" },
        { label: "Delivery", caption: "Live tracking" },
        { label: "COD", caption: "টাকার হিসাব" },
        { label: "Profit", caption: "আসল লাভ" },
      ],
    },
    features: {
      eyebrow: "Features",
      title: "ব্যবসা চালাতে যা যা লাগে, সব এখানে",
      description: "Excel sheet, খাতা আর দশটা Messenger tab-এর বদলে একটাই dashboard।",
      items: [
        {
          title: "Order Management",
          description:
            "Manual বা Facebook, Instagram, WhatsApp থেকে আসা সব order এক list-এ — confirm থেকে delivery পর্যন্ত ধাপে ধাপে।",
        },
        {
          title: "Customer CRM",
          description: "Phone number দিয়ে customer খুঁজুন, আগের সব order, delivered আর returned history এক পাতায় দেখুন।",
        },
        {
          title: "Inventory Sync",
          description: "Order confirm হলেই stock কমে যায়, প্রতিটি পরিবর্তনের পূর্ণ log থাকে। Stock কমে এলে alert পাবেন।",
        },
        {
          title: "Multi-Courier Booking",
          description: "Order page থেকেই এক click-এ parcel booking। Steadfast দিয়ে শুরু, আরও courier যুক্ত হচ্ছে।",
        },
        {
          title: "COD Reconciliation",
          description: "কোন parcel delivered, কোনটা returned, কত টাকা COD বাকি — courier update থেকে নিজে থেকেই হিসাব হয়।",
        },
        {
          title: "Profit Dashboard",
          description: "আজকের revenue, order, delivered আর pending — এক নজরে, গতকালের সাথে তুলনা সহ।",
        },
      ],
    },
    pricing: {
      eyebrow: "Pricing",
      title: "ব্যবসার সাইজ অনুযায়ী plan",
      description: "Free-তে শুরু করুন, order বাড়লে upgrade করুন। কোনো hidden charge নেই।",
      perMonth: "/মাস",
      mostPopular: "Most Popular",
      limits: {
        orders: "মাসে {count}টি order",
        ordersUnlimited: "Unlimited order",
        users: "{count} জন user",
        oneUser: "১ জন user",
        usersUnlimited: "যত খুশি user",
      },
      plans: {
        free: {
          cta: "Start Free",
          extras: ["Order ও customer management", "Inventory tracking", "Steadfast courier booking"],
        },
        starter: {
          cta: "Get Starter",
          extras: ["Free-এর সবকিছু", "Low-stock alert", "COD tracking"],
        },
        growth: {
          cta: "Get Growth",
          extras: ["Starter-এর সবকিছু", "পূর্ণ stock movement log", "Priority support"],
        },
        business: {
          cta: "Get Business",
          extras: ["Growth-এর সবকিছু", "Multiple store", "Dedicated onboarding"],
        },
        enterprise: {
          name: "Enterprise",
          tagline:
            "Brand, agency বা বড় warehouse operation-এর জন্য custom plan — volume pricing, custom integration আর dedicated support।",
          price: "Custom",
          cta: "Contact Sales",
        },
      },
    },
    faq: {
      eyebrow: "FAQ",
      title: "সাধারণ কিছু প্রশ্ন",
      description: "আরও কিছু জানার থাকলে demo book করুন — আমরা নিজে দেখিয়ে দেব।",
      items: [
        {
          question: "Courier integration কীভাবে কাজ করে?",
          answer:
            "Settings-এ আপনার Steadfast account-এর API key একবার যোগ করুন। এরপর কোনো order ship করার জন্য ready হলে order page থেকেই parcel book করতে পারবেন। Courier থেকে আসা delivery update নিজে থেকেই order-এর status বদলে দেয় — আলাদা করে courier portal চেক করতে হয় না। আপাতত Steadfast সাপোর্ট করে, আরও courier শীঘ্রই আসছে।",
        },
        {
          question: "COD reconciliation কি automatic?",
          answer:
            "প্রতিটি parcel-এর COD amount, আর সেটা delivered নাকি returned — এগুলো courier update থেকে automatic track হয়, তাই dashboard-এ সবসময় আসল হিসাব দেখবেন। Courier-এর payout statement-এর সাথে টাকা মিলিয়ে দেখার পুরো automatic ব্যবস্থা পরের update-এ যোগ হবে।",
        },
        {
          question: "আমি কি multiple Facebook page manage করতে পারব?",
          answer:
            "হ্যাঁ। একাধিক page, Instagram বা WhatsApp থেকে আসা সব order একই dashboard-এ রাখতে পারবেন, আর প্রতিটি order-এ তার source লেখা থাকে। Facebook page সরাসরি connect করে Messenger থেকে order টেনে আনার সুবিধা এখনো আসেনি — আপাতত order দ্রুত হাতে তৈরি করে নিতে হবে।",
        },
        {
          question: "Free plan-এ কী limit আছে?",
          answer:
            "Free plan-এ মাসে ৫০টি order আর ১ জন user। Order, customer, inventory আর courier booking — মূল সব feature ব্যবহার করতে পারবেন। Credit card লাগে না।",
        },
        {
          question: "Data কি secure?",
          answer:
            "প্রতিটি ব্যবসার data database স্তরেই আলাদা করা থাকে, তাই এক account কখনো অন্য account-এর কিছু দেখতে পারে না। Courier API key encrypted vault-এ রাখা হয়, সাধারণ text হিসেবে নয়। সব connection HTTPS দিয়ে সুরক্ষিত।",
        },
        {
          question: "Mobile থেকে ব্যবহার করা যাবে?",
          answer:
            "হ্যাঁ, যেকোনো browser থেকে চলে। তবে প্রতিদিনের order management-এর জন্য laptop বা desktop-এ কাজ করা সবচেয়ে আরামদায়ক।",
        },
      ],
    },
    footer: {
      ...en.marketing.footer,
      tagline: "Facebook ও Instagram seller-দের জন্য order থেকে COD পর্যন্ত এক dashboard।",
    },
  },
};
