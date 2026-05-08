# VADKUL Project Management

> Last Updated: 2026-02-06

## 🚀 Project Overview
VADKUL is a spontaneous social event application that helps people discover and join events near them.
- **Live Site**: [vadkul.se](https://vadkul.se)
- **Status**: Active Development
- **Tech Stack**: Next.js, Firebase, TypeScript, Tailwind CSS

---

## 📊 Project Status

### Current Phase: Post-Migration Stabilization
Recent migration from Vite to Next.js completed. Focus on stabilization and optimization.

---

## 🔥 High Priority

### Bugs & Issues
- [ ] Clean up `.firebase/` directory - many modified/deleted files in git status
- [ ] Verify all pages work after Next.js migration (login, profile, settings, admin, etc.)
- [ ] Fix environment variables (migrated from `VITE_*` to `NEXT_PUBLIC_*`)
- [ ] Test Firebase authentication flow in Next.js
- [ ] Verify map functionality works correctly in production

### Critical Features
- [ ] Add proper error boundaries for better error handling
- [ ] Implement loading states for all async operations
- [ ] Add analytics tracking (new component folder exists but may be incomplete)

---

## 🎯 Feature Backlog

### User Experience
- [ ] Add event notifications (when someone joins your event)
- [ ] Implement real-time chat for events
- [ ] Add ability to share events via link
- [ ] Create event templates for common event types
- [ ] Add photo uploads for events
- [ ] Implement user ratings/reviews for events
- [ ] Add calendar view for events
- [ ] Create "favorite events" feature

### Social Features
- [ ] Friend system (add/remove friends)
- [ ] Private events (invite-only)
- [ ] Event comments/discussion
- [ ] User following system
- [ ] Event series/recurring events

### Discovery & Search
- [ ] Advanced search filters (date range, specific times)
- [ ] Saved searches
- [ ] Event recommendations based on history
- [ ] Category-based browsing improvements
- [ ] "Trending now" section

### Map Enhancements
- [ ] Show user's current location indicator
- [ ] Add directions to event location
- [ ] Implement map zoom memory
- [ ] Add heatmap view for popular areas
- [ ] Custom map markers per event category

---

## 🛠️ Technical Debt

### Code Quality
- [ ] Add unit tests for services (eventService, settingsService)
- [ ] Add integration tests for key user flows
- [ ] Set up E2E testing with Playwright/Cypress
- [ ] Improve TypeScript type coverage (reduce `any` usage)
- [ ] Add JSDoc comments to complex functions
- [ ] Extract magic numbers to constants

### Performance
- [ ] Optimize bundle size (analyze with Next.js bundle analyzer)
- [ ] Implement image optimization for event photos
- [ ] Add service worker for offline support
- [ ] Optimize Firestore queries (add indexes where needed)
- [ ] Implement infinite scroll for event list
- [ ] Add skeleton loaders instead of spinners

### Architecture
- [ ] Move more logic from components to services
- [ ] Create custom hooks for repeated logic
- [ ] Standardize error handling across app
- [ ] Implement proper logging system
- [ ] Add API route handlers for server-side operations
- [ ] Set up proper environment configuration

### Security
- [ ] Implement rate limiting for event creation
- [ ] Add input validation and sanitization
- [ ] Review and update Firestore security rules
- [ ] Implement CSRF protection
- [ ] Add content moderation for event descriptions
- [ ] Set up security headers (CSP, etc.)

---

## 📝 Documentation

- [ ] Update README with Next.js migration details
- [ ] Create CONTRIBUTING.md guide
- [ ] Document Firebase setup steps
- [ ] Create architecture diagram
- [ ] Add API documentation
- [ ] Write deployment guide
- [ ] Create user guide/FAQ
- [ ] Document component library

---

## 🐛 Known Issues

### Next.js Migration
- [ ] Verify all static exports work correctly
- [ ] Check if any Vite-specific code remains
- [ ] Update build scripts if needed
- [ ] Test SSR vs CSR behavior for all pages

### UI/UX
- [ ] Scroll restoration could be more reliable
- [ ] Mobile responsiveness needs testing on various devices
- [ ] Dark mode toggle persistence could be improved
- [ ] Some animations may feel janky on slower devices

### Firebase
- [ ] Check for any Firebase v8 vs v9 API inconsistencies
- [ ] Optimize Firestore reads (may be hitting quota)
- [ ] Review Firebase hosting configuration

---

## 💡 Ideas & Future Enhancements

### Long-term Vision
- [ ] Mobile app (React Native?)
- [ ] Integration with other social platforms
- [ ] Event ticketing system
- [ ] Monetization strategy (premium features?)
- [ ] Multi-language support (English, etc.)
- [ ] Event analytics dashboard for hosts
- [ ] AI-powered event suggestions
- [ ] Gamification (badges, achievements)

### Marketing & Growth
- [ ] SEO optimization
- [ ] Social media integration
- [ ] Referral program
- [ ] Email campaigns for events
- [ ] Partnership with local businesses
- [ ] University/organization partnerships

---

## 📅 Sprint Planning

### Current Sprint (Week of 2026-02-06)
**Goal**: Stabilize Next.js migration and clean up codebase

#### Tasks
- [ ] Review and clean `.firebase/` directory changes
- [ ] Test all routes and pages
- [ ] Verify production deployment works
- [ ] Fix any environment variable issues
- [ ] Complete analytics implementation

---

## 🎉 Completed

### Recent Wins
- ✅ Migrated from Vite to Next.js
- ✅ Fixed cloud functions with Next.js
- ✅ Implemented Hall of Fame feature
- ✅ Added search functionality
- ✅ Improved filtering system (age groups, free events, etc.)
- ✅ Implemented TanStack Query for data fetching
- ✅ Added map/list view toggle with persistence
- ✅ Created welcome modal for new users
- ✅ Implemented scroll restoration

---

## 📌 Notes

### Development Workflow
1. Create feature branch from `main`
2. Implement feature/fix
3. Test locally
4. Deploy to Firebase preview
5. Merge to main
6. Deploy to production

### Useful Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
firebase deploy      # Deploy to production
```

### Important Links
- [Firebase Console](https://console.firebase.google.com)
- [Next.js Docs](https://nextjs.org/docs)
- [Production Site](https://vadkul.se)

---

## 🤝 Contributing

When picking up a task:
1. Mark it as in progress: `[🔄]`
2. Move from `[ ]` to `[x]` when complete
3. Add notes if needed
4. Update sprint planning section

### Status Icons
- `[ ]` - Not started
- `[🔄]` - In progress
- `[x]` - Complete
- `[🔥]` - Urgent
- `[💡]` - Idea/Optional
