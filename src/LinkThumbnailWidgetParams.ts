import { RequestUrlParam, requestUrl } from "obsidian";
import { decode } from 'iconv-lite';
import localforage from "localforage";

interface ogData {
    "ogTitle": string,
    "ogDescription": string,
    "ogImage": string,
    "ogImageAlt": string,
    "ogUrl": string
}

// url 정규식
export const urlRegex = new RegExp("^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$");
const baseUrl = new RegExp("^https?:\\/\\/[^\\/]+");
const charsetRegex = new RegExp(/charset=["']?(.+?)["']/i);

// 저장하기 전에 img 데이터를 url-> blob -> base64로 변환 후 저장
async function getImgFile(imgUrl: string) {
    const imgFormat = ["jpg", "jpeg", "png", "bmp", "tif", "gif", "svg"];
    try {
        let imgType = "";
        imgFormat.forEach((format) => {
            if (imgUrl.includes(format)) {
                imgType = format;
            }
        });

        const options: RequestUrlParam = {
            url: imgUrl,
            contentType: `image/${imgType}`
        }

        const file = await requestUrl(options);
        const fileArrayBuffer = file.arrayBuffer;

        // 방법 2) ArrayBuffer 자체를 base64로 변환
        const uint8 = new Uint8Array(fileArrayBuffer);
        const base64String = btoa(uint8.reduce((data, byte)=> {
            return data + String.fromCharCode(byte);
        }, ''));
        if (imgType.includes("svg")) imgType += "+xml";
        return `data:image/${imgType};charset=utf-8;base64,` + base64String;

    } catch (error) {
        console.log(error);
        return "";
    }
}

async function getOgData(url: string) {
    try { 
        const response = await requestUrl(url);
        const contentType = response.headers["content-type"];
        if (response && response.headers && contentType && !contentType?.includes('text/')) {
            throw new Error('Page must return a header content-type with text/');
        }

        // 인코딩 문제 해결
        const bodyArrayBuffer = response.arrayBuffer;        
        const regex = charsetRegex.exec(response.text);
        
        let charset = "utf-8";
        if (regex) {
            charset = regex[1];
        } else {
            charset = contentType.substring(contentType.indexOf("charset=") + 8, contentType.length);
        }

        let body;
        if (charset === "utf-8") {
            body = Buffer.from(bodyArrayBuffer).toString('utf-8');
        } else {
            body = decode(Buffer.from(bodyArrayBuffer), charset);
        }
        
        const parser = new DOMParser();
        const document = parser.parseFromString(body, 'text/html');
        
        const base = baseUrl.exec(url);
        const ogTitle = document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.querySelector("title")?.textContent || "";
        const ogDescription = document.querySelector("meta[property='og:description']")?.getAttribute("content") || "";
        let ogImage = "";
        let imgUrl = document.querySelector("meta[property='og:image']")?.getAttribute("content") || "";
        if (base && imgUrl !== "") {
            if (imgUrl.startsWith("//")) {
                imgUrl = "https:" + imgUrl;
            } else if (!imgUrl.startsWith("http")) {
                imgUrl = base[0] + (imgUrl.startsWith("/"))? "" : "/" + imgUrl;
            }
            ogImage = await getImgFile(imgUrl);
        }

        const ogImageAlt = document.querySelector("meta[property='og:image:alt']")?.getAttribute("content") || "";
        const ogUrl = document.querySelector("meta[property='og:url']")?.getAttribute("content") || url;

        const data: ogData = {
            "ogTitle": ogTitle,
            "ogDescription": ogDescription,
            "ogImage": ogImage,
            "ogImageAlt": ogImageAlt,
            "ogUrl": ogUrl
        }

        await localforage.setItem(url, data);
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

function template(data: ogData): string {
    return `
        ${(data?.ogImage === "")? "" : `<div class="og-thumbnail"><img src="${data?.ogImage}" alt="${data?.ogImageAlt}" loading="lazy"></img></div>`}
        <div class="og-info-container">
            <strong class="og-info">${data?.ogTitle}</strong>
            <description class="og-summary">${data?.ogDescription}</description>
            <span class="og-url">${data?.ogUrl}</span>
        </div>
    `;
}

export async function LinkThumbnailWidgetParams(url: string) {
    const data = await localforage.getItem(url) as ogData;
    if (data) return template(data);
    
    const ogData = await getOgData(url);
    if (ogData) return template(ogData);

    return null;
}