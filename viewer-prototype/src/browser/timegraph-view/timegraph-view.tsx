import * as React from 'react';
import { TimeGraphContainer, TimeGraphContainerOptions } from 'timeline-chart/lib/time-graph-container';
import { TimeGraphUnitController } from 'timeline-chart/lib/time-graph-unit-controller';
import { TimeGraphAxis } from 'timeline-chart/lib/layer/time-graph-axis';
import { TimeGraphAxisCursors } from 'timeline-chart/lib/layer/time-graph-axis-cursors';
import { TimeGraphChartGrid } from 'timeline-chart/lib/layer/time-graph-chart-grid';
import { TimeGraphChart } from 'timeline-chart/lib/layer/time-graph-chart';
// import { TimeGraphChartArrows } from 'timeline-chart/lib/layer/time-graph-chart-arrows'
import { TimeGraphChartCursors } from 'timeline-chart/lib/layer/time-graph-chart-cursors';
import { TimeGraphChartSelectionRange } from 'timeline-chart/lib/layer/time-graph-chart-selection-range';
import { TimeGraphNavigator } from 'timeline-chart/lib/layer/time-graph-navigator';
import { TimeGraphVerticalScrollbar } from 'timeline-chart/lib/layer/time-graph-vertical-scrollbar';
import { TimeGraphLayer } from 'timeline-chart/lib/layer/time-graph-layer';
import { TimeGraphRowElementStyle, TimeGraphRowElement } from 'timeline-chart/lib/components/time-graph-row-element';
import { TimeGraphRowController } from 'timeline-chart/lib/time-graph-row-controller';
import { TimelineChart } from 'timeline-chart/lib/time-graph-model';
// import { TspDataProvider } from './tsp-data-provider';
import { TspClient } from 'tsp-typescript-client/lib/protocol/tsp-client';
import { TestDataProvider } from './test-data-provider';

export class TimeGraphView {

    protected styleConfig = {
        mainWidth: 1000,
        mainHeight: 300,
        naviBackgroundColor: 0xf7eaaf,
        chartBackgroundColor: 0xf9f6e8,
        cursorColor: 0xb77f09
    }
    protected rowHeight = 16;
    protected totalHeight: number = 0;

    protected unitController: TimeGraphUnitController;
    protected rowController: TimeGraphRowController;
    protected dataProvider: TestDataProvider;
    protected timeGraphData?: TimelineChart.TimeGraphModel;

    protected chartLayer: TimeGraphChart;
    // protected arrows: TimeGraphChartArrows;
    protected vscrollLayer: TimeGraphVerticalScrollbar;

    protected styleMap = new Map<string, TimeGraphRowElementStyle>();

    constructor(client: TspClient, traceUUID: string) {
        // this.dataProvider = new TspDataProvider(client, traceUUID, this.styleConfig.mainWidth);
        this.dataProvider = new TestDataProvider(this.styleConfig.mainWidth);
        this.unitController = new TimeGraphUnitController(0);
        this.rowController = new TimeGraphRowController(this.rowHeight, this.totalHeight);

        const providers = {
            dataProvider: async (range: TimelineChart.TimeGraphRange, resolution: number) => {
                if (this.unitController) {
                    const length = range.end - range.start;
                    const overlap = ((length * 5) - length) / 2;
                    const start = range.start - overlap > 0 ? range.start - overlap : 0;
                    const end = range.end + overlap < this.unitController.absoluteRange ? range.end + overlap : this.unitController.absoluteRange;
                    const newRange: TimelineChart.TimeGraphRange = { start, end };
                    const newResolution: number = resolution * 0.8;
                    this.timeGraphData = await this.dataProvider.getData({range:newRange});
                    // this.timeGraphData = await this.dataProvider.getData(newRange);
                    if (selectedElement) {
                        for (const row of this.timeGraphData.rows) {
                            const selEl = row.states.find(el => el.id === selectedElement.id);
                            if (selEl) {
                                selEl.selected = true;
                                break;
                            }
                        }
                    }
                    return {
                        rows: this.timeGraphData.rows,
                        range: newRange,
                        resolution: newResolution
                    };
                }
                return {
                    rows: [],
                    range: { start: 0, end: 0 },
                    resolution: 0
                };
            },
            rowElementStyleProvider: (model: TimelineChart.TimeGraphRowElementModel) => {
                const styles: TimeGraphRowElementStyle[] = [
                    {
                        color: 0x11ad1b,
                        height: this.rowHeight * 0.8
                    }, {
                        color: 0xbc2f00,
                        height: this.rowHeight * 0.7
                    }, {
                        color: 0xccbf5d,
                        height: this.rowHeight * 0.6
                    }
                ];
                let style: TimeGraphRowElementStyle | undefined = styles[0];
                if (model.data && model.data.value) {
                    const val = model.data.value;
                    style = this.styleMap.get(val);
                    if (!style) {
                        style = styles[(this.styleMap.size % styles.length)];
                        this.styleMap.set(val, style);
                    }
                }
                return {
                    color: style.color,
                    height: style.height,
                    borderWidth: model.selected ? 1 : 0
                };
            },
            rowStyleProvider: (row: TimelineChart.TimeGraphRowModel) => {
                return {
                    backgroundColor: 0xe0ddcf,
                    backgroundOpacity: row.selected ? 0.6 : 0,
                    lineColor: row.data && row.data.hasStates ? 0xdddddd : 0xaa4444,
                    lineThickness: row.data && row.data.hasStates ? 1 : 3
                }
            }
        }

        this.chartLayer = new TimeGraphChart('timeGraphChart', providers, this.rowController);
        let selectedElement: TimeGraphRowElement;
        this.chartLayer.onSelectedRowElementChanged((model) => {
            const el = this.chartLayer.getElementById(model.id);
            if (el) {
                selectedElement = el;
            }
        });
        // this.arrows = new TimeGraphChartArrows('timeGraphChartArrows', this.rowController);
        // this.arrows.addArrows(timeGraph.arrows);
        this.vscrollLayer = new TimeGraphVerticalScrollbar('timeGraphVerticalScrollbar', this.rowController);
        this.initialize(client, traceUUID);
    }

    protected async initialize(client: TspClient, traceUUID: string) {
        this.timeGraphData = await this.dataProvider.getData({});
        // this.timeGraphData = await this.dataProvider.getData();
        this.unitController.absoluteRange = this.timeGraphData.totalLength;
        this.unitController.numberTranslator = (theNumber: number) => {
            const milli = Math.floor(theNumber / 1000000);
            const micro = Math.floor((theNumber % 1000000) / 1000);
            const nano = Math.floor((theNumber % 1000000) % 1000);
            return milli + ':' + micro + ':' + nano;
        };

        this.totalHeight = this.timeGraphData.rows.length * this.rowHeight;
        this.rowController.totalHeight = this.totalHeight;
    }

    renderTimeGraphChart(): React.ReactNode {
        return <React.Fragment>
            <div>
                {this.getAxisContainer()}
                {this.getChartContainer()}
                {this.getNaviContainer()}
            </div>
            <div id='main-vscroll'>
                {this.getVerticalScrollbar()}
            </div>
        </React.Fragment >
    }

    protected getAxisContainer() {
        const axisLayer = this.getAxisLayer();
        const axisCursorLayer = this.getAxisCursors();
        return <ReactTimeGraphContainer
            id='timegraph-axis'
            options={{
                id: 'timegraph-axis',
                height: 30,
                width: this.styleConfig.mainWidth,
                backgroundColor: 0xFFFFFF
            }}
            unitController={this.unitController}
            layer={[axisLayer, axisCursorLayer]}>
        </ReactTimeGraphContainer>;
    }

    protected getAxisLayer() {
        const timeAxisLayer = new TimeGraphAxis('timeGraphAxis', { color: this.styleConfig.naviBackgroundColor });
        return timeAxisLayer;
    }

    protected getAxisCursors() {
        return new TimeGraphAxisCursors('timeGraphAxisCursors', { color: this.styleConfig.cursorColor });
    }

    protected getChartContainer() {
        const grid = new TimeGraphChartGrid('timeGraphGrid', this.rowHeight);

        const cursors = new TimeGraphChartCursors('chart-cursors', this.chartLayer, this.rowController, { color: this.styleConfig.cursorColor });
        const selectionRange = new TimeGraphChartSelectionRange('chart-selection-range', { color: this.styleConfig.cursorColor });

        return <ReactTimeGraphContainer
            options={
                {
                    id: 'timegraph-chart',
                    height: this.styleConfig.mainHeight,
                    width: this.styleConfig.mainWidth,
                    backgroundColor: this.styleConfig.chartBackgroundColor
                }
            }
            unitController={this.unitController}
            id='timegraph-chart'
            layer={[
                grid, this.chartLayer, selectionRange, cursors
            ]}
        >
        </ReactTimeGraphContainer>;
    }

    protected getNaviContainer() {
        const navi = new TimeGraphNavigator('timeGraphNavigator');
        return <ReactTimeGraphContainer
            id='navi'
            options={{
                width: this.styleConfig.mainWidth,
                height: 10,
                id: 'navi',
                backgroundColor: this.styleConfig.naviBackgroundColor
            }}
            unitController={this.unitController}
            layer={[navi]}></ReactTimeGraphContainer>
    }

    protected getVerticalScrollbar() {
        return <ReactTimeGraphContainer
            id='vscroll'
            options={{
                id: 'vscroll',
                width: 10,
                height: this.styleConfig.mainHeight,
                backgroundColor: this.styleConfig.naviBackgroundColor
            }}
            unitController={this.unitController}
            layer={[this.vscrollLayer]}
        ></ReactTimeGraphContainer>;
    }
}

export namespace ReactTimeGraphContainer {
    export interface Props {
        id: string,
        options: TimeGraphContainerOptions,
        unitController: TimeGraphUnitController,
        layer: TimeGraphLayer[]
    }
}

export class ReactTimeGraphContainer extends React.Component<ReactTimeGraphContainer.Props> {
    protected ref: HTMLCanvasElement | undefined;

    componentDidMount() {
        const container = new TimeGraphContainer(this.props.options, this.props.unitController, this.ref);
        this.props.layer.forEach(l => {
            container.addLayer(l);
        });
    }

    render() {
        return <canvas ref={ref => this.ref = ref || undefined} onWheel={e => e.preventDefault()}></canvas>
    }

}
