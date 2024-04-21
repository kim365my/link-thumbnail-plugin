import { MarkdownPostProcessorContext } from "obsidian";
import LinkThumbnailPlugin from "./main";
import { LinkThumbnailWidgetParams } from "./LinkThumbnailWidgetParams";

export class PostProcessor {
	plugin: LinkThumbnailPlugin;

	constructor(plugin: LinkThumbnailPlugin) {
		this.plugin = plugin;
	}

	processor = async (
		element: HTMLElement,
		context: MarkdownPostProcessorContext
	) => {
		// 링크 변환
		const linkEls:Element[] = element.findAll("a.external-link:not(.cm-formatting, .markdown-rendered)");
		for (const linkEl of linkEls) {
			if (!linkEl.closest(".noLinkThumbnail")) {				
				const url = linkEl.innerHTML;
				const params = await LinkThumbnailWidgetParams(url);
				if (params != null) {
					linkEl.innerHTML = params;
					linkEl.addClass("markdown-rendered");
					linkEl.setAttribute("data-tooltip-position", "top");
					linkEl.setAttribute("aria-label", url);
					linkEl.addEventListener("click", (e) => e.stopPropagation());
				}
			}
		}
	};

	isDisabled = (el: Element) => {
		return false;
	};
}