export interface SourceInventoryRecord {source:string;destination:string;bytes:number;sha256:string}
export function sourceInventory(root?:string): Map<string,SourceInventoryRecord>;
export function originalPath(relative:string):string;
