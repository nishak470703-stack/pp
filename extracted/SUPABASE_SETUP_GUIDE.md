# Supabase Setup Guide

This guide will walk you through setting up your Supabase project for the Local Pocket Reader Firefox extension.

## 1. Create a Project on Supabase

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Click **New Project** and configure your database name, location, and root password.
3. Once the project is created, navigate to **Project Settings** > **API**.
4. Retrieve the **Project URL** and the **anon public key**.
5. Open [supabase-config.js](supabase-config.js) in your text editor and fill in these values.

## 2. Initialize the Database Schema

1. In the Supabase sidebar, select the **SQL Editor**.
2. Click **New Query**.
3. Copy the contents of [supabase-setup.sql](supabase-setup.sql) and paste them into the SQL Editor.
4. Click **Run**. Verify that the `sync_data` and `backup_data` tables are created with RLS enabled.

> **Note:** The code uses a 2-table schema (`sync_data` for incremental sync, `backup_data` for full backups). The `SUPABASE_DATABASE_STRUCTURE.md` document describes a more detailed planned schema — the actual code does not use those tables yet.

## 3. Enable Email/Password Auth

1. Go to **Authentication** > **Providers** > **Email**.
2. Ensure **Enable Email provider** is enabled.
3. (Optional) Turn off **Confirm Email** for easier local developer testing.

## 4. Configure Google OAuth (Optional)

If you wish to log in using Google:
1. Enable Google OAuth on your Supabase dashboard at **Authentication** > **Providers** > **Google**.
2. Generate an OAuth Client ID of type **Web application** in your [Google Cloud Console](https://console.cloud.google.com/).
3. Set the redirect URI in Google Cloud Console to:
   `https://<your-extension-id>.moz-extension.org/`
   *(You can find your extension ID in `about:debugging` once the extension is loaded).*
4. In your Supabase Dashboard, enter your Client ID and Client Secret in the Google Provider settings.
5. Add the redirect URI to your Supabase allowed redirect URIs list in **Authentication** > **URL Configuration** > **Redirect URIs**.
