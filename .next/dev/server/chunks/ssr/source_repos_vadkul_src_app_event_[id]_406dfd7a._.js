module.exports = [
"[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "alt",
    ()=>alt,
    "contentType",
    ()=>contentType,
    "default",
    ()=>Image,
    "runtime",
    ()=>runtime,
    "size",
    ()=>size
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$og$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/og.js [app-rsc] (ecmascript)");
(()=>{
    const e = new Error("Cannot find module '../../services/serverEventService'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
;
;
const runtime = 'nodejs'; // Use nodejs runtime for firebase-admin
const alt = 'Event Cover Image';
const size = {
    width: 1200,
    height: 630
};
const contentType = 'image/png';
async function Image({ params }) {
    const { id } = await params;
    const event = await serverEventService.getEventById(id);
    // Fallback data if event not found
    const title = event?.title || 'VADKUL Event';
    const location = event?.location?.name || 'Okänd plats';
    const dateStr = event?.time ? new Date(event.time).toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit'
    }) : '';
    const categoryEmoji = '🎉'; // We could ideally map this from categories.ts but keeping it simple for server-side
    return new __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$og$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ImageResponse"](/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        style: {
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#1a1a1a',
            backgroundImage: 'linear-gradient(to bottom right, #1a1a1a, #2a2a2a)',
            color: 'white',
            fontFamily: 'sans-serif',
            position: 'relative'
        },
        children: [
            event?.coverImage && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                src: event.coverImage,
                style: {
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.3
                }
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                lineNumber: 50,
                columnNumber: 21
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    textAlign: 'center',
                    padding: '40px',
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    borderRadius: '20px',
                    border: '2px solid rgba(255,255,255,0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    maxWidth: '90%'
                },
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 100,
                            marginBottom: 20,
                            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))'
                        },
                        children: categoryEmoji
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                        lineNumber: 78,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 60,
                            fontWeight: 'bold',
                            marginBottom: 20,
                            lineHeight: 1.1,
                            textShadow: '0 4px 10px rgba(0,0,0,0.5)',
                            background: 'linear-gradient(to right, #fff, #ccc)',
                            backgroundClip: 'text',
                            color: 'transparent'
                        },
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                        lineNumber: 88,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 32,
                            color: '#e0e0e0',
                            marginBottom: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        },
                        children: [
                            "📅 ",
                            dateStr
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                        lineNumber: 103,
                        columnNumber: 21
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            fontSize: 32,
                            color: '#a0a0a0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                        },
                        children: [
                            "📍 ",
                            location
                        ]
                    }, void 0, true, {
                        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                        lineNumber: 116,
                        columnNumber: 21
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                lineNumber: 62,
                columnNumber: 17
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    bottom: 40,
                    fontSize: 24,
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: 'bold',
                    letterSpacing: '2px'
                },
                children: "VADKUL.SE"
            }, void 0, false, {
                fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
                lineNumber: 130,
                columnNumber: 17
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx",
        lineNumber: 33,
        columnNumber: 13
    }, this), {
        ...size
    });
}
}),
"[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image--metadata.js [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$app$2f$event$2f5b$id$5d2f$opengraph$2d$image$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/src/app/event/[id]/opengraph-image.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$lib$2f$metadata$2f$get$2d$metadata$2d$route$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/source/repos/vadkul/node_modules/next/dist/lib/metadata/get-metadata-route.js [app-rsc] (ecmascript)");
;
;
const imageModule = {
    alt: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$app$2f$event$2f5b$id$5d2f$opengraph$2d$image$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["alt"],
    contentType: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$app$2f$event$2f5b$id$5d2f$opengraph$2d$image$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["contentType"],
    runtime: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$app$2f$event$2f5b$id$5d2f$opengraph$2d$image$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["runtime"],
    size: __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$src$2f$app$2f$event$2f5b$id$5d2f$opengraph$2d$image$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["size"]
};
async function __TURBOPACK__default__export__(props) {
    const { __metadata_id__: _, ...params } = await props.params;
    const imageUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$source$2f$repos$2f$vadkul$2f$node_modules$2f$next$2f$dist$2f$lib$2f$metadata$2f$get$2d$metadata$2d$route$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fillMetadataSegment"])("/event/[id]", params, "opengraph-image");
    function getImageMetadata(imageMetadata, idParam) {
        const data = {
            alt: imageMetadata.alt,
            type: imageMetadata.contentType || 'image/png',
            url: imageUrl + (idParam ? '/' + idParam : '') + "?fc35448f52b6634e"
        };
        const { size } = imageMetadata;
        if (size) {
            data.width = size.width;
            data.height = size.height;
        }
        return data;
    }
    return [
        getImageMetadata(imageModule, '')
    ];
}
}),
];

//# sourceMappingURL=source_repos_vadkul_src_app_event_%5Bid%5D_406dfd7a._.js.map