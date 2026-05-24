
export interface IFacebookEventScrapeResult {
    title: string;
    image: string;
    going: number;
    description: string;
    locationName: string;
    exactTime: string | null;
    isoDate: string | null;
    textContent: string;
    hostName: string;
    hostUrl: string | null;
    locationUrl: string | null;
    ogDescription?: string;
}

export interface FacebookSource {
    url: string;
    filters: string[];
}
