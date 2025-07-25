import {deepAccess, flatten, isArray, logError, parseSizesInput} from '../src/utils.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {VIDEO} from '../src/mediaTypes.js';
import {Renderer} from '../src/Renderer.js';
import {
  getUserSyncsFn,
  isBidRequestValid,
  supportedMediaTypes
} from '../libraries/adtelligentUtils/adtelligentUtils.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 * @typedef {import('../src/adapters/bidderFactory.js').BidderRequest} BidderRequest
 */

const URL = 'https://ghb.sync.viewdeos.com/auction/';
const OUTSTREAM_SRC = 'https://player.sync.viewdeos.com/outstream-unit/2.01/outstream.min.js';
const BIDDER_CODE = 'viewdeosDX';
const OUTSTREAM = 'outstream';
const DISPLAY = 'display';
const syncsCache = {};

export const spec = {
  code: BIDDER_CODE,
  aliases: ['viewdeos'],
  supportedMediaTypes,
  isBidRequestValid,
  getUserSyncs: function (syncOptions, serverResponses) {
    return getUserSyncsFn(syncOptions, serverResponses, syncsCache)
  },
  /**
   * Make a server request from the list of BidRequests
   * @param bidRequests
   * @param bidderRequest
   */
  buildRequests: function (bidRequests, bidderRequest) {
    return {
      data: bidToTag(bidRequests, bidderRequest),
      bidderRequest,
      method: 'GET',
      url: URL
    };
  },

  /**
   * Unpack the response from the server into a list of bids
   * @param {Object} serverResponse
   * @param {BidderRequest} bidderRequest
   * @return {Bid[]} An array of bids which were nested inside the server
   */
  interpretResponse: function (serverResponse, {bidderRequest}) {
    serverResponse = serverResponse.body;
    let bids = [];

    if (!isArray(serverResponse)) {
      return parseRTBResponse(serverResponse, bidderRequest);
    }

    serverResponse.forEach(serverBidResponse => {
      bids = flatten(bids, parseRTBResponse(serverBidResponse, bidderRequest));
    });

    return bids;
  }
};

function parseRTBResponse(serverResponse, bidderRequest) {
  const isInvalidValidResp = !serverResponse || !isArray(serverResponse.bids);

  const bids = [];

  if (isInvalidValidResp) {
    const extMessage = serverResponse && serverResponse.ext && serverResponse.ext.message ? `: ${serverResponse.ext.message}` : '';
    const errorMessage = `in response for ${bidderRequest.bidderCode} adapter ${extMessage}`;

    logError(errorMessage);

    return bids;
  }

  serverResponse.bids.forEach(serverBid => {
    const requestId = bidderRequest.bids.findIndex((bidRequest) => {
      return bidRequest.bidId === serverBid.requestId;
    });

    if (serverBid.cpm !== 0 && requestId !== -1) {
      const bidReq = bidderRequest.bids[requestId];
      const bid = createBid(serverBid, getMediaType(bidReq), bidReq.params);

      bids.push(bid);
    }
  });

  return bids;
}

function bidToTag(bidRequests, bidderRequest) {
  const tag = {
    // TODO: is 'page' the right value here?
    domain: deepAccess(bidderRequest, 'refererInfo.page')
  };

  if (deepAccess(bidderRequest, 'gdprConsent.gdprApplies')) {
    tag.gdpr = 1;
    tag.gdpr_consent = deepAccess(bidderRequest, 'gdprConsent.consentString');
  }

  if (deepAccess(bidderRequest, 'bidderRequest.uspConsent')) {
    tag.us_privacy = bidderRequest.uspConsent;
  }

  for (let i = 0, length = bidRequests.length; i < length; i++) {
    Object.assign(tag, prepareRTBRequestParams(i, bidRequests[i]));
  }

  return tag;
}

/**
 * Parse mediaType
 * @param _index {number}
 * @param bid {object}
 * @returns {object}
 */
function prepareRTBRequestParams(_index, bid) {
  const mediaType = deepAccess(bid, 'mediaTypes.video') ? VIDEO : DISPLAY;
  const index = !_index ? '' : `${_index + 1}`;
  const sizes = bid.sizes ? bid.sizes : (mediaType === VIDEO ? deepAccess(bid, 'mediaTypes.video.playerSize') : deepAccess(bid, 'mediaTypes.banner.sizes'));
  return {
    ['callbackId' + index]: bid.bidId,
    ['aid' + index]: bid.params.aid,
    ['ad_type' + index]: mediaType,
    ['sizes' + index]: parseSizesInput(sizes).join()
  };
}

/**
 * Prepare all parameters for request
 * @param bidderRequest {object}
 * @returns {object}
 */
function getMediaType(bidderRequest) {
  const videoMediaType = deepAccess(bidderRequest, 'mediaTypes.video');
  const context = deepAccess(bidderRequest, 'mediaTypes.video.context');

  return !videoMediaType ? DISPLAY : context === OUTSTREAM ? OUTSTREAM : VIDEO;
}

/**
 * Configure new bid by response
 * @param bidResponse {object}
 * @param mediaType {Object}
 * @returns {object}
 */
function createBid(bidResponse, mediaType, bidderParams) {
  const bid = {
    requestId: bidResponse.requestId,
    creativeId: bidResponse.cmpId,
    height: bidResponse.height,
    currency: bidResponse.cur,
    width: bidResponse.width,
    cpm: bidResponse.cpm,
    netRevenue: true,
    mediaType,
    ttl: 3600,
    meta: {
      advertiserDomains: bidResponse.adomain || []
    }
  };

  if (mediaType === DISPLAY) {
    return Object.assign(bid, {
      ad: bidResponse.ad
    });
  }

  Object.assign(bid, {
    vastUrl: bidResponse.vastUrl
  });

  if (mediaType === OUTSTREAM) {
    Object.assign(bid, {
      mediaType: 'video',
      adResponse: bidResponse,
      renderer: newRenderer(bidResponse.requestId, bidderParams)
    });
  }

  return bid;
}

/**
 * Create  renderer
 * @param requestId
 * @param bidderParams
 * @returns {*}
 */
function newRenderer(requestId, bidderParams) {
  const renderer = Renderer.install({
    id: requestId,
    url: OUTSTREAM_SRC,
    config: bidderParams.outstream || {},
    loaded: false
  });

  renderer.setRender(outstreamRender);

  return renderer;
}

/**
 * Initialise outstream
 * @param bid
 */
function outstreamRender(bid) {
  bid.renderer.push(() => {
    const opts = Object.assign({}, bid.renderer.getConfig(), {
      width: bid.width,
      height: bid.height,
      vastUrl: bid.vastUrl,
      elId: bid.adUnitCode
    });
    window.VOutstreamAPI.initOutstreams([opts]);
  });
}

registerBidder(spec);
