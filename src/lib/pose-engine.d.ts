/* Types for the hand-written figure engine ported verbatim from reference/lifting-plan.html. */
declare const PF: {
  mount: (
    svg: SVGSVGElement,
    id: string
  ) => {
    draw: (t: number, mode: string) => void;
    tAt: (ms: number) => number;
    view?: string;
  };
  ids: string[];
};
export default PF;
