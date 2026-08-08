@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand: #3730a3;
}

body {
  background-color: #f5f6fa;
  color: #1e2130;
}

/* Taekwondo-inspired animated hero background: blue mat, red/blue sparring
   gear, indigo brand color, shifting slowly like a competition-hall banner. */
@keyframes hero-shift {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}
.hero-bg {
  background-image: linear-gradient(120deg, #1e1b4b 0%, #1d4ed8 25%, #dc2626 50%, #1d4ed8 75%, #1e1b4b 100%);
  background-size: 300% 300%;
  animation: hero-shift 20s ease infinite;
}
@media (prefers-reduced-motion: reduce) {
  .hero-bg {
    animation: none;
  }
}

/* Slim colorful accent strip used above the app header and event cards. */
.accent-bar {
  background-image: linear-gradient(90deg, #1d4ed8, #dc2626, #1d4ed8);
  background-size: 200% 100%;
  animation: hero-shift 12s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .accent-bar {
    animation: none;
  }
}

.btn {
  @apply inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}
.btn-primary {
  @apply btn bg-brand-600 text-white hover:bg-brand-700;
}
.btn-secondary {
  @apply btn bg-white text-gray-700 border border-gray-300 hover:bg-gray-50;
}
.btn-danger {
  @apply btn bg-red-600 text-white hover:bg-red-700;
}
.input {
  @apply block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500;
}
.label {
  @apply mb-1 block text-sm font-medium text-gray-700;
}
.card {
  @apply rounded-lg border border-gray-200 bg-white shadow-sm;
}
.table-base {
  @apply w-full text-left text-sm;
}
.table-base th {
  @apply border-b border-gray-200 bg-gray-50 px-3 py-2 font-semibold text-gray-600;
}
.table-base td {
  @apply border-b border-gray-100 px-3 py-2 align-top;
}
.badge {
  @apply inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium;
}
