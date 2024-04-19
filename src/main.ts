import { Plugin } from 'obsidian';
import { asyncDecoBuilderExt } from './EnbedDecoratiion';
import { PostProcessor } from './PostProcessor';
import localforage from 'localforage';
  


export default class LinkThumbnailPlugin extends Plugin {
	/**
	 * @returns true if Live Preview is supported
	 */
	isUsingLivePreviewEnabledEditor(): boolean {
		//@ts-ignore
		return !this.app.vault.getConfig('legacyEditor');
	}

    async onload() {
		localforage.config({
			name: "ogDataCache"
		})

		// In LivePre view Mode
		if (this.isUsingLivePreviewEnabledEditor()) {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const Prec = require("@codemirror/state").Prec;
			this.registerEditorExtension(Prec.lowest(asyncDecoBuilderExt(this)));
		}
		// In Reading Mode
		const postProcessor = new PostProcessor(this);
        this.registerMarkdownPostProcessor(postProcessor.processor);

		// updateOptions
		this.registerEvent(this.app.workspace.on('css-change', () => {
			this.app.workspace.updateOptions();
		}));

		this.addCommand({
			id: "remove-to-all-ogData",
			name: "Remove to all ogData",
			callback: () => {
				localforage.clear();
			}
		})

		this.app.workspace.updateOptions();
    }
	async onunload() {
		console.log("disabling plugin: link");
	}

}