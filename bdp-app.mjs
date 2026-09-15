import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=f5982f77d39c";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=f5982f77d39c";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

await import("./bdp-graph-renderers.js?v=f5982f77d39c");
await import("./bdp-top-view-visibility.js?v=f5982f77d39c");
await import("./bdp-ui-adapter.js?v=f5982f77d39c");
await import("./bdp-v2-core.js?v=f5982f77d39c");
await import("./bdp-v2-provider.js?v=f5982f77d39c");
