import {debounce, editorLivePreviewField} from "obsidian";
import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from "@codemirror/view";
import {StateField, StateEffect, StateEffectType, Range} from "@codemirror/state";
import {syntaxTree, tokenClassNodeProp} from "@codemirror/language";
import LinkThumbnailPlugin from "./main";
import { LinkThumbnailWidgetParams, urlRegex } from "./LinkThumbnailWidgetParams";
import { WidgetType } from "@codemirror/view";

//based on: https://gist.github.com/nothingislost/faa89aa723254883d37f45fd16162337

interface TokenSpec {
    from: number;
    to: number;
    value: string;
}

const statefulDecorations = defineStatefulDecoration();

class StatefulDecorationSet {
    editor: EditorView;
    decoCache: { [cls: string]: Decoration } = Object.create(null);
    plugin: LinkThumbnailPlugin;

    constructor(editor: EditorView, plugin: LinkThumbnailPlugin) {
        this.editor = editor;
        this.plugin = plugin;
    }

    async computeAsyncDecorations(tokens: TokenSpec[]): Promise<DecorationSet | null> {    
        // 현재 선택된 부분
        const selectFrom = this.editor.state.selection.main.from;
        const selectTo = this.editor.state.selection.main.to;
    
        tokens = tokens.filter((token) => {
            // 현재 선택영역 판별
            const isSelected = (selectFrom <= token.to && selectTo >= token.from) || (selectFrom >= token.from && selectTo <= token.to);
            // url이 적합한 지 판벌
            const isUrl = urlRegex.test(token.value);
            return !isSelected && isUrl
        });

        const decorations: Range<Decoration>[] = [];
        for (const token of tokens) {    
            let deco = this.decoCache[token.value];
            
            if (!deco) {
                const widget = await LinkThumbnailWidgetParams(token.value);
                if (widget === null) {
                    deco = this.decoCache[token.value] = Decoration.mark({attributes: {class: "noLinkThumbnail"}});
                } else {
                    const div = createDiv();
                    // 클래스 추가
                    div.className = "cm-embed-block cm-embed-link";
                    // 넣을 EL 받아오기
                    const linkEl = createEl("a");
                    linkEl.href = token.value;
                    linkEl.className = "markdown-rendered external-link og-link";
                    linkEl.setAttribute("data-tooltip-position", "top");
                    linkEl.setAttribute("aria-label", token.value);
                    linkEl.addEventListener("click", (e) => e.stopPropagation());
                    div.appendChild(linkEl);

                    linkEl.innerHTML = widget;
                    deco = this.decoCache[token.value] = Decoration.replace({widget: new ogLinkWidget(div), block: true});
                }
                
            }
            decorations.push(deco.range(token.from, token.to));
        }
        return Decoration.set(decorations, true);
    }

    debouncedUpdate = debounce(this.updateAsyncDecorations, 100, true);

    async updateAsyncDecorations(tokens: TokenSpec[]): Promise<void> {
        // 현재 모드 판별
        const isLivePreviewMode = this.editor.state.field(editorLivePreviewField);
        const decorations = (isLivePreviewMode)? await this.computeAsyncDecorations(tokens): null;
        // if our compute function returned nothing and the state field still has decorations, clear them out
        if (decorations || this.editor.state.field(statefulDecorations.field).size) {
            this.editor.dispatch({effects: statefulDecorations.update.of(decorations || Decoration.none)});
        }
    }
}

function buildViewPlugin(plugin: LinkThumbnailPlugin) {
    return ViewPlugin.fromClass(
        class {
            decoManager: StatefulDecorationSet;

            constructor(view: EditorView) {
                this.decoManager = new StatefulDecorationSet(view, plugin);
                this.buildAsyncDecorations(view);
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.buildAsyncDecorations(update.view);
                }
            }

            buildAsyncDecorations(view: EditorView) {
                const targetElements: TokenSpec[] = [];
                try {
                    const tree = syntaxTree(view.state);
                    tree.iterate({
                        enter: ({node, from, to}) => {
                            const tokenProps = node.type.prop<string>(tokenClassNodeProp);
                            if (tokenProps && node.name === "url") {
                                const parentElement = node.parent?.type;
                                if (parentElement?.prop<string>(tokenClassNodeProp)?.includes("noLinkThumbnail")) {
                                    return;
                                }
                                const value = view.state.doc.sliceString(from, to);
                                if (value) {
                                    targetElements.push({from: from, to: to, value: value});
                                }
                            }
                        },
                    });
                } catch (error) {
                    console.error("Custom CM6 view plugin failure", error);
                    throw error;
                }
                this.decoManager.debouncedUpdate(targetElements);
            }
        }
    );
}

export function asyncDecoBuilderExt(plugin: LinkThumbnailPlugin) {
    return [statefulDecorations.field, buildViewPlugin(plugin)];
}

////////////////
// Utility Code
////////////////

// Generic helper for creating pairs of editor state fields and
// effects to model imperatively updated decorations.
// source: https://github.com/ChromeDevTools/devtools-frontend/blob/8f098d33cda3dd94b53e9506cd3883d0dccc339e/front_end/panels/sources/DebuggerPlugin.ts#L1722
function defineStatefulDecoration(): {
    update: StateEffectType<DecorationSet>;
    field: StateField<DecorationSet>;
} {
    const update = StateEffect.define<DecorationSet>();
    const field = StateField.define<DecorationSet>({
        create(): DecorationSet {
            return Decoration.none;
        },
        update(deco, tr): DecorationSet {
            return tr.effects.reduce((deco, effect) => (effect.is(update) ? effect.value : deco), deco.map(tr.changes));
        },
        provide: field => EditorView.decorations.from(field),
    });
    return {update, field};
}
class ogLinkWidget extends WidgetType {
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

