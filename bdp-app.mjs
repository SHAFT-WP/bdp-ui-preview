import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=e39a9d5c6737";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=e39a9d5c6737";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

await import("./bdp-graph-renderers.js?v=e39a9d5c6737");
await import("./bdp-ui-adapter.js?v=e39a9d5c6737");
await import("./bdp-v2-core.js?v=e39a9d5c6737");
await import("./bdp-v2-provider.js?v=e39a9d5c6737");
