# Render Deployment Guide

Follow these steps to deploy your app on Render!

## 1. Prerequisites
1. A GitHub/GitLab/Bitbucket account with your code repository
2. A MongoDB Atlas account (or other MongoDB hosting) for your database
3. All required API keys (GROQ, Google TTS, etc.)

## 2. Deploy using Render Blueprint (Easiest Way)
1. Fork this repository to your GitHub account
2. Go to https://render.com and sign up/in
3. Click "New" → "Blueprint"
4. Connect your forked repository
5. Review the blueprint and click "Apply"
6. Set the required secret environment variables in the Render dashboard:
   - GROQ_API_KEY
   - EMAIL_USER
   - EMAIL_PASSWORD
   - GOOGLE_CLIENT_ID
   - GOOGLE_TTS_API_KEY

## 3. Manual Deployment Steps
If you don't want to use the blueprint, follow these steps:
1. Create a new Web Service on Render
2. Choose your repository and branch
3. Set the following:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run server:prod`
4. Add the following environment variables:
   | Key | Value |
   |-----|-------|
   | NODE_ENV | production |
   | PORT | 3000 |
   | FRONTEND_URL | https://med-bot-r5k5.onrender.com |
   | MONGODB_URI | Your MongoDB connection string (from Atlas or similar) |
   | GROQ_API_KEY | Your GROQ API Key |
   | GROQ_MODEL | llama-3.3-70b-versatile |
   | EMAIL_SERVICE | gmail |
   | EMAIL_USER | Your email address |
   | EMAIL_PASSWORD | Your email password or app-specific password |
   | GOOGLE_CLIENT_ID | Your Google OAuth client ID |
   | JWT_SECRET | Generate a random 32-byte string |
   | GOOGLE_TTS_API_KEY | Your Google TTS API Key |
   | GOOGLE_TTS_VOICE | en-US-Neural2-F |
5. Create a new MongoDB database on Render (or use MongoDB Atlas)
6. Update the MONGODB_URI environment variable to use your database's connection string
7. Deploy your service!

## 4. Verify
Once your service is deployed, visit https://med-bot-r5k5.onrender.com to test it out!
