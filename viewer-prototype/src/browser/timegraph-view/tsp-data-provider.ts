import { TspClient } from "tsp-typescript-client/lib/protocol/tsp-client";
import { TimeGraphEntry, TimeGraphRow, TimeGraphModel, TimeGraphState } from "tsp-typescript-client/lib/models/timegraph";
import { TimelineChart } from "timeline-chart/lib/time-graph-model";
import { QueryHelper } from "tsp-typescript-client/lib/models/query/query-helper";
import { EntryHeader } from "tsp-typescript-client/lib/models/entry";

export class TspDataProvider {

    protected canvasDisplayWidth: number;

    private client: TspClient;
    private traceUUID: string;
    private timeGraphEntries: TimeGraphEntry[];
    private timeGraphRows: TimeGraphRow[];

    public totalRange: number;

    constructor(client: TspClient, traceUUID: string, canvasDisplayWidth: number) {
        this.timeGraphEntries = new Array();
        this.timeGraphRows = new Array();
        this.canvasDisplayWidth = canvasDisplayWidth;
        this.client = client;
        this.traceUUID = traceUUID;
        this.totalRange = 0;
    }

    async getData(viewRange?: TimelineChart.TimeGraphRange): Promise<TimelineChart.TimeGraphModel> {
        const resourcesTreeParameters = QueryHelper.timeQuery([0, 1]);
        const treeResponse = await this.client.fetchTimeGraphTree<TimeGraphEntry, EntryHeader>(
            this.traceUUID,
            'org.eclipse.tracecompass.internal.analysis.os.linux.core.threadstatus.ResourcesStatusDataProvider',
            resourcesTreeParameters);
        this.timeGraphEntries = treeResponse.model.entries;
        this.totalRange = this.timeGraphEntries[0].endTime;
        const selectedItems = new Array<number>();
        this.timeGraphEntries.forEach(timeGraphEntry => {
            selectedItems.push(timeGraphEntry.id);
        });
        let startRange: number = this.timeGraphEntries[0].startTime;
        let endRange: number = startRange + this.totalRange;
        if (viewRange) {
            startRange = viewRange.start;
            endRange = viewRange.end;
        }
        const resolution: number = viewRange ? this.canvasDisplayWidth / (viewRange.end - viewRange.start) : this.canvasDisplayWidth / this.totalRange;
        const statesParameters = QueryHelper.selectionTimeQuery(QueryHelper.splitRangeIntoEqualParts(startRange, endRange, resolution), selectedItems);
        const stateResponse = await this.client.fetchTimeGraphStates<TimeGraphModel>(
            this.traceUUID,
            'org.eclipse.tracecompass.internal.analysis.os.linux.core.threadstatus.ResourcesStatusDataProvider',
            statesParameters);

        this.timeGraphRows = stateResponse.model.rows;
        
        const rows: TimelineChart.TimeGraphRowModel[] = [];

        this.timeGraphRows.forEach((row:TimeGraphRow, idx: number) => {
            const entry = this.timeGraphEntries.find(entry => entry.id === row.entryId);
            if(entry){
                const states = this.getStateModelByRow(row);
                rows.push({
                    id: row.entryId,
                    name: 'row' + row.entryId,
                    range: {
                        start: entry.startTime,
                        end: entry.endTime
                    },
                    states
                });
            }
        })

        return {
            id: 'model',
            totalLength: this.totalRange,
            arrows: [],
            rows
        }
    }

    protected getStateModelByRow(row:TimeGraphRow){
        const states: TimelineChart.TimeGraphRowElementModel[] = [];
        row.states.forEach((state:TimeGraphState, idx:number)=>{
            states.push({
                id: row.entryId + "-" + idx,
                label: state.label,
                range: {
                    start: state.startTime,
                    end: state.endTime
                }
            })
        })
        return states;
    }
}
