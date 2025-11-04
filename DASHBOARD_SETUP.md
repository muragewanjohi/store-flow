# **Vendure Dashboard Setup Guide**

## **Two Ways to Run the Dashboard**

### **Option 1: Use Built Dashboard (Recommended for Testing)**

1. **Build the dashboard:**
   ```bash
   npm run build:dashboard
   ```

2. **Start Vendure server:**
   ```bash
   npm run dev
   ```

3. **Access dashboard:**
   - Go to: `http://localhost:3000/dashboard`
   - The dashboard is served directly from the built files

**Pros:**
- ✅ Simple setup
- ✅ No separate Vite server needed
- ✅ Production-like environment

**Cons:**
- ❌ Need to rebuild after config changes
- ❌ No hot reload

---

### **Option 2: Use Vite Dev Server (Hot Reload)**

For development with hot reload, you need to run Vite separately:

1. **Terminal 1 - Start Vendure server:**
   ```bash
   npm run dev:server
   ```

2. **Terminal 2 - Start Vite dev server:**
   ```bash
   npx vite
   ```

3. **Configure DashboardPlugin** to use Vite dev server (update `vendure-config.ts`):
   ```typescript
   DashboardPlugin.init({
       route: 'dashboard',
       viteDevServerPort: 5173, // Vite's default port
   }),
   ```

4. **Access dashboard:**
   - Go to: `http://localhost:3000/dashboard`
   - Vendure will proxy to Vite dev server on port 5173

**Pros:**
- ✅ Hot reload during development
- ✅ Faster iteration

**Cons:**
- ❌ Requires two terminals
- ❌ More complex setup

---

## **Current Setup (What You Have Now)**

✅ Dashboard is **built** and located in `dist/dashboard/`  
✅ Vendure server is configured to serve from `dist/dashboard/` in dev mode

**Next Steps:**
1. Stop any standalone Vite server (the one on port 5173)
2. Restart your Vendure server (`npm run dev`)
3. Access: `http://localhost:3000/dashboard`

---

## **Troubleshooting**

**Black screen?**
- Check browser console (F12) for errors
- Verify `dist/dashboard/index.html` exists
- Restart Vendure server after building dashboard

**404 errors?**
- Make sure dashboard is built: `npm run build:dashboard`
- Check that Vendure server is running on port 3000
- Verify DashboardPlugin is configured correctly

**Need to rebuild after config changes?**
- Run: `npm run build:dashboard`
- Restart Vendure server

---

## **Production Deployment**

For production, always use the built dashboard:
```bash
npm run build:dashboard
npm run build  # Build TypeScript
npm start      # Start production server
```

