import {
  SVG_DIAGRAM_PRIMITIVES_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  svgNode,
} from "./common/diagram/svg-primitives-v0.1.mjs?v=36ac73d6020e";
import {
  SVG_PNG_EXPORT_V0_1,
  saveSvgAsPng,
} from "./common/diagram/svg-png-export-v0.1.mjs?v=36ac73d6020e";

window.BDPCommonDiagram = Object.freeze({
  primitivesModel: SVG_DIAGRAM_PRIMITIVES_V0_1,
  pngExportModel: SVG_PNG_EXPORT_V0_1,
  SVG_NS,
  appendGrid,
  createOpenArrowMarker,
  saveSvgAsPng,
  svgNode,
});

await import("./bdp-graph-renderers.js?v=36ac73d6020e");
await import("./bdp-ui-adapter.js?v=36ac73d6020e");
await import("./bdp-v2-core.js?v=36ac73d6020e");
await import("./bdp-v2-provider.js?v=36ac73d6020e");
