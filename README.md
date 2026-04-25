# Email Tracker - Bulk Email Sending & Reply Tracking

A local web application for bulk email sending via Gmail API with real-time reply tracking. No backend server required—everything runs in your browser using IndexedDB for data storage.

## Features

### Core Functionality
- **Bulk Email Sending** - Send emails to hundreds of contacts with configurable delays
- **Email Templates** - Create reusable email templates with {{name}} variable support for personalization
- **Contact Management** - Import contacts via Excel/CSV, search, filter, and manage easily
- **Reply Tracking** - Automatic polling system detects incoming replies in real-time
- **Resend Functionality** - Easily resend emails to contacts who haven't replied yet
- **Progress Tracking** - Real-time progress display during bulk sending operations

### Dashboard
- Summary statistics (total emails, sent, replied, not replied)
- Quick action buttons for common tasks
- Reply tracking status with polling controls
- Getting started checklist

### Contact Management
- Search and filter contacts by email or name
- Sort by name, status, or date
- View contact status (pending, sent, replied)
- Delete contacts
- Bulk import with column mapping

## Getting Started

### Prerequisites
- Gmail account with Gmail API access
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Excel or CSV file with contacts (email and name columns)

### Step 1: Get Gmail Access Token

1. Visit [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. Click the settings icon (gear) in the top right
3. Enable "Use your own OAuth credentials" (optional but recommended)
4. In the left panel, search for "Gmail API v1"
5. Select `https://www.googleapis.com/auth/gmail.modify`
6. Click "Authorize APIs"
7. Complete the authentication flow
8. Click "Exchange authorization code for tokens"
9. Copy the "Access Token" value

### Step 2: Launch the App

1. Open the application
2. Click "Add Token" when prompted
3. Paste your Gmail access token
4. Click "Add Token" to validate and save

### Step 3: Import Contacts

1. Click "Import Contacts"
2. Upload an Excel (.xlsx) or CSV file
3. Select the columns for email and name
4. Review the preview
5. Click "Import Contacts"

### Step 4: Create Email Template

1. Click "New Template"
2. Enter a subject line and email body
3. Use {{name}} for personalization (e.g., "Hello {{name}},")
4. Preview your template in the Preview tab
5. Click "Save Template"

### Step 5: Send Emails

1. Click "Send Email"
2. Select the template to use
3. Adjust the delay between emails (500-5000ms)
4. Review the estimated send time
5. Click "Send to [N] Contacts"
6. Monitor the progress in real-time

### Step 6: Track Replies

1. Click "Start Polling" in the Reply Tracking card
2. The system will check for replies every 60 seconds
3. When a reply is detected, the contact status updates automatically
4. View replied contacts in the "Replied" tab

### Step 7: Resend to Non-Responders

1. Go to the "Not Replied" tab
2. Click the menu icon next to a contact
3. Click "Resend"
4. Select a template
5. Click "Resend Email"

## Technical Details

### Architecture
- **Frontend**: Next.js 16 with React 19
- **Storage**: IndexedDB (browser-native, no backend required)
- **Database**: None - all data stored locally in your browser
- **Authentication**: Gmail OAuth access token (user-provided)
- **Styling**: Tailwind CSS + shadcn/ui components

### Data Storage
All data is stored locally in your browser using IndexedDB:
- **Contacts** - Email addresses, names, send status, thread IDs
- **Templates** - Email subjects and bodies
- **Send Logs** - Records of sent emails with success/failure status

### API Integration
- Uses Gmail REST API directly from the browser
- No backend proxy required
- Token stored in sessionStorage (cleared when tab closes)
- CORS handled by Gmail API's public endpoints

### Reply Detection
- Polls Gmail API every 60 seconds (configurable)
- Checks thread message count for new messages
- Detects if sender is not the authenticated user
- Updates contact status to "replied" automatically

## Security & Privacy

### Token Security
- Access token stored in sessionStorage (not persisted)
- Token cleared when browser tab closes
- No token data sent to external servers
- No backend server means no data transmission

### Data Privacy
- All data stored locally in your browser's IndexedDB
- No server-side storage or processing
- No tracking or analytics
- No internet connection needed after initial setup

### Email Sending
- Emails sent directly via Gmail API
- Standard Gmail SMTP security
- Full email headers with proper authentication

## Limitations & Known Issues

### Gmail API Rate Limits
- Gmail has rate limits on API requests
- Recommended: 500-1000ms delay between emails
- Large batches (500+) may take several minutes

### Reply Detection
- Automatic detection works for standard email replies
- Auto-replies and bots may be detected as replies
- Manual review recommended for important campaigns

### Token Expiration
- Access tokens expire after 1 hour
- App will show token invalid error when expired
- Simply add a new token when prompted

### Polling Intervals
- Reply checking interval is fixed at 60 seconds
- Customizable in future versions
- Use manual refresh for immediate results

## Troubleshooting

### "Invalid Token" Error
- Ensure you copied the entire access token
- Token may have expired - get a new one from OAuth Playground
- Check Gmail API quota in Google Cloud Console

### Emails Not Sending
- Verify Gmail API is enabled for your account
- Check that you have quota remaining in Google Cloud Console
- Try with a smaller batch first (5-10 emails)
- Check browser console for detailed error messages

### Replies Not Detected
- Ensure polling is enabled (blue indicator in Polling Status)
- Check that contacts have threadId (sent through app)
- Reply may not be in the same thread (manual mark as replied needed)
- Try manual refresh button for immediate check

### Data Lost After Closing Browser
- All data is stored in IndexedDB, persists between sessions
- Only sessionStorage (token) is cleared on tab close
- Clear cache/cookies manually if experiencing issues
- Export important data before major changes

## Development

### Install Dependencies
```bash
pnpm install
```

### Run Development Server
```bash
pnpm dev
```

### Build for Production
```bash
pnpm build
```

### Project Structure
```
app/
├── components/
│   ├── dashboard/        # Dashboard stats & polling status
│   ├── contacts/         # Contact table & filtering
│   ├── dialogs/          # Token, import, template, send, resend
│   └── provider/         # Token context provider
├── hooks/                # Custom React hooks
├── lib/                  # Utilities (gmail, indexeddb, types)
└── page.tsx             # Main page component
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console errors (F12 > Console tab)
3. Clear browser cache and try again
4. Ensure Gmail API is properly configured

## License

Created with v0.app


https://www.googleapis.com/auth/gmail.modify