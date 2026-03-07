<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1LY0IxojhXJULZXYcisZAmO7tyafq78wt

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Configure environment variables:
   Copy `.env.example` to `.env.local` and fill in your Supabase credentials.
3. Run the app:
   `npm run dev`

## Deploy to Vercel

To deploy this project to Vercel, follow these steps:

1. **Root Directory**: Since the project is in a subdirectory, you MUST set the **Root Directory** to `Safety-SecurityMedical-platform` in your Vercel project settings.
2. **Environment Variables**: Add the following environment variables in Vercel:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL.
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key.
3. **Build Command**: The default build command (`npm run build`) will work correctly once the root directory is set.
