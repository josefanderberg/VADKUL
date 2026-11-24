/**
 * SHIM: kartans lutning nära inpå och 3D-husen (#286) bor i @vadkul/kontrakt
 * (packages/kontrakt/src/cameraTilt.ts), så att appen får samma kurva och
 * samma hus när den tar steget. Testerna ligger där.
 */
export {
    addBuilding3dLayer, BUILDING_3D_LAYER_ID, BUILDING_3D_MIN_ZOOM, needsTiltEase, pitchForZoom,
    TILT_EASE_MS, TILT_FULL_ZOOM, TILT_MAX_DEG, TILT_START_ZOOM, type TiltStyle,
} from '@vadkul/kontrakt';
