interface CosensePageApi {
	insertLine(text: string, index: number): void;
	updateLine(text: string, index: number): void;
	waitForSave(): Promise<void>;
	lines?: ScrapboxLine[];
}

interface CosenseGlobal {
	Page?: CosensePageApi;
}

interface ScrapboxLine {
	id?: string;
	text: string;
}

interface ScrapboxPage {
	title?: string;
	lines?: ScrapboxLine[];
}

interface ScrapboxPageMenuApi {
	addMenu(menu: {
		title: string;
		image?: string;
		icon?: string;
		onClick?: () => void;
	}): void;
}

interface ScrapboxGlobal {
	Page?: ScrapboxPage;
	on?(event: "page:changed", listener: () => void): void;
	PageMenu?: ScrapboxPageMenuApi;
}

interface Window {
	cosense?: CosenseGlobal;
	scrapbox?: ScrapboxGlobal;
}
