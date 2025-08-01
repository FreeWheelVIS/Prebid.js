import {isStr, logError, isFn, deepAccess} from '../src/utils.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {config} from '../src/config.js';
import {BANNER, VIDEO, NATIVE} from '../src/mediaTypes.js';
import {convertOrtbRequestToProprietaryNative} from '../src/native.js';

const BIDDER_CODE = 'admixer';
const GVLID = 511;
const ENDPOINT_URL = 'https://inv-nets.admixer.net/prebid.1.2.aspx';
const ALIASES = [
  {code: 'go2net', endpoint: 'https://ads.go2net.com.ua/prebid.1.2.aspx'},
  'adblender',
  {code: 'futureads', endpoint: 'https://ads.futureads.io/prebid.1.2.aspx'},
  {code: 'smn', endpoint: 'https://ads.smn.rs/prebid.1.2.aspx'},
  {code: 'admixeradx', endpoint: 'https://inv-nets.admixer.net/adxprebid.1.2.aspx'},
  'rtbstack',
  'theads',
];
const RTB_RELATED_ALIASES = [
  'rtbstack',
  'theads',
];
export const spec = {
  code: BIDDER_CODE,
  gvlid: GVLID,
  aliases: ALIASES.map(val => isStr(val) ? val : val.code),
  supportedMediaTypes: [BANNER, VIDEO, NATIVE],
  /**
   * Determines whether or not the given bid request is valid.
   */
  isBidRequestValid: function (bid) {
    return RTB_RELATED_ALIASES.includes(bid.bidder)
      ? !!bid.params.tagId
      : !!bid.params.zone;
  },
  /**
   * Make a server request from the list of BidRequests.
   */
  buildRequests: function (validRequest, bidderRequest) {
    // convert Native ORTB definition to old-style prebid native definition
    validRequest = convertOrtbRequestToProprietaryNative(validRequest);

    let w;
    let docRef;
    do {
      w = w ? w.parent : window;
      try {
        docRef = w.document.referrer;
      } catch (e) {
        break;
      }
    } while (w !== window.top);
    const payload = {
      imps: [],
      ortb2: bidderRequest.ortb2,
      docReferrer: docRef};
    let endpointUrl;
    if (bidderRequest) {
      // checks if there is specified any endpointUrl in bidder config
      endpointUrl = config.getConfig('bidderURL');
      if (!endpointUrl && RTB_RELATED_ALIASES.includes(bidderRequest.bidderCode)) {
        logError(`The bidderUrl config is required for ${bidderRequest.bidderCode} bids. Please set it with setBidderConfig() for "${bidderRequest.bidderCode}".`);
        return;
      }
      // TODO: is 'page' the right value here?
      if (bidderRequest.refererInfo?.page) {
        payload.referrer = encodeURIComponent(bidderRequest.refererInfo.page);
      }
      if (bidderRequest.gdprConsent) {
        payload.gdprConsent = {
          consentString: bidderRequest.gdprConsent.consentString,
          // will check if the gdprApplies field was populated with a boolean value (ie from page config).  If it's undefined, then default to true
          gdprApplies: (typeof bidderRequest.gdprConsent.gdprApplies === 'boolean') ? bidderRequest.gdprConsent.gdprApplies : true
        };
      }
      if (bidderRequest.uspConsent) {
        payload.uspConsent = bidderRequest.uspConsent;
      }
    }
    validRequest.forEach((bid) => {
      const imp = {};
      Object.keys(bid).forEach(key => {
        imp[key] = bid[key];
      });
      imp.ortb2 && delete imp.ortb2;
      const bidFloor = getBidFloor(bid);
      if (bidFloor) {
        imp.bidFloor = bidFloor;
      }
      payload.imps.push(imp);
    });

    const urlForRequest = endpointUrl || getEndpointUrl(bidderRequest.bidderCode)
    return {
      method: 'POST',
      url: urlForRequest,
      data: payload,
    };
  },
  /**
   * Unpack the response from the server into a list of bids.
   */
  interpretResponse: function (serverResponse, bidRequest) {
    const bidResponses = [];
    try {
      const {body: {ads = []} = {}} = serverResponse;
      ads.forEach((ad) => bidResponses.push(ad));
    } catch (e) {
      logError(e);
    }
    return bidResponses;
  },
  getUserSyncs: function(syncOptions, serverResponses, gdprConsent) {
    const pixels = [];
    serverResponses.forEach(({body: {cm = {}} = {}}) => {
      const {pixels: img = [], iframes: frm = []} = cm;
      if (syncOptions.pixelEnabled) {
        img.forEach((url) => pixels.push({type: 'image', url}));
      }
      if (syncOptions.iframeEnabled) {
        frm.forEach((url) => pixels.push({type: 'iframe', url}));
      }
    });
    return pixels;
  }
};

function getEndpointUrl(code) {
  return ((ALIASES) || []).find((val) => val.code === code)?.endpoint || ENDPOINT_URL;
}

function getBidFloor(bid) {
  if (!isFn(bid.getFloor)) {
    return deepAccess(bid, 'params.bidFloor', 0);
  }

  try {
    const bidFloor = bid.getFloor({
      currency: 'USD',
      mediaType: '*',
      size: '*',
    });
    return bidFloor?.floor;
  } catch (_) {
    return 0;
  }
}

registerBidder(spec);
