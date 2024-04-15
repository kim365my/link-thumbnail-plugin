import { WidgetType } from "@codemirror/view";

export class ogLinkWidget extends WidgetType {
    private readonly source: HTMLDivElement;

    constructor(source: HTMLDivElement) {
        super();
        this.source = source;
    }

    eq(other: ogLinkWidget) {
        return other == this;
    }

    toDOM() {
        return this.source;
    }

    ignoreEvent(): boolean {
        return false;
    }
}
