import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=b0468e5a155e";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=b0468e5a155e";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

await import("./bdp-graph-renderers.js?v=b0468e5a155e");
await import("./bdp-top-view-visibility.js?v=b0468e5a155e");
await import("./bdp-ui-adapter.js?v=b0468e5a155e");
await import("./bdp-v2-core.js?v=b0468e5a155e");
await import("./bdp-v2-provider.js?v=b0468e5a155e");
