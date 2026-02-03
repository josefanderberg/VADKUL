module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/source/repos/vadkul/src/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/source/repos/vadkul/src/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/source/repos/vadkul/src/app/event/[id]/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>EventDetailsPage,
    "generateMetadata",
    ()=>generateMetadata
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/shared/lib/app-dynamic.js [app-rsc] (ecmascript)");
(()=>{
    const e = new Error("Cannot find module '../../services/serverEventService'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
;
;
;
const EventDetails = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"])(()=>__turbopack_context__.A("[project]/source/repos/vadkul/src/views/EventDetails.tsx [app-rsc] (ecmascript, next/dynamic entry, async loader)"), {
    loadableGenerated: {
        modules: [
            "[project]/source/repos/vadkul/src/views/EventDetails.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false
});
async function generateMetadata({ params }) {
    const { id } = await params;
    const event = await serverEventService.getEventById(id);
    if (!event) {
        return {
            title: 'Event hittades inte | VADKUL',
            description: 'Detta event kunde inte hittas.'
        };
    }
    // Format date efficiently
    const dateStr = event.time ? new Date(event.time).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    const title = `${event.title} ${dateStr} | VADKUL`;
    const description = event.description ? event.description.substring(0, 160) : `Kom och häng på ${event.title}!`;
    return {
        title: title,
        description: description,
        openGraph: {
            title: title,
            description: description,
            images: [
                {
                    url: event.coverImage || '/og-default.png',
                    width: 1200,
                    height: 630,
                    alt: event.title
                }
            ],
            locale: 'sv_SE',
            type: 'website'
        }
    };
}
function EventDetailsPage() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(EventDetails, {}, void 0, false, {
        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/page.tsx",
        lineNumber: 63,
        columnNumber: 12
    }, this);
}
}),
"[project]/source/repos/vadkul/src/app/event/[id]/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/source/repos/vadkul/src/app/event/[id]/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a10cecfd._.js.map