# 🚀 Deployment Guide

## Prerequisites
- GitHub account
- Vercel account (free tier available)
- Supabase account (free tier available)

## Step 1: Set up Supabase Database

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose organization and enter project details
   - Wait for project to be created

2. **Get Database Credentials**
   - Go to Settings → API
   - Copy your Project URL and anon/public key
   - Save these for later use

3. **Create Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Copy and paste the SQL from `supabase.js` (lines 15-50)
   - Run the SQL to create tables and insert default data

## Step 2: Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Video Topic Review System"
   git branch -M main
   git remote add origin https://github.com/yourusername/your-repo-name.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the Node.js project

3. **Configure Environment Variables**
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add the following variables:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anon key
   - Make sure to add them for all environments (Production, Preview, Development)

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your app will be live at the provided Vercel URL

## Step 3: Test Deployment

1. **Verify Database Connection**
   - Visit your deployed app
   - Try adding a person in "Manage People"
   - Check if data persists in Supabase dashboard

2. **Test All Features**
   - Add people
   - Submit videos
   - Change statuses
   - Export CSV
   - Delete functionality

## Step 4: Custom Domain (Optional)

1. **Add Custom Domain**
   - In Vercel dashboard, go to Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

## Troubleshooting

### Common Issues

1. **Environment Variables Not Working**
   - Ensure variables are set in Vercel dashboard
   - Redeploy after adding variables
   - Check variable names match exactly

2. **Database Connection Errors**
   - Verify Supabase URL and key are correct
   - Check if Supabase project is active
   - Ensure RLS policies allow operations

3. **Build Failures**
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

### Support

- Vercel Documentation: [vercel.com/docs](https://vercel.com/docs)
- Supabase Documentation: [supabase.com/docs](https://supabase.com/docs)
- GitHub Issues: Create an issue in your repository

## Post-Deployment Checklist

- [ ] Database schema created successfully
- [ ] Environment variables configured
- [ ] App deployed and accessible
- [ ] All CRUD operations working
- [ ] CSV export functional
- [ ] People management working
- [ ] Video workflow complete
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Performance monitoring set up
