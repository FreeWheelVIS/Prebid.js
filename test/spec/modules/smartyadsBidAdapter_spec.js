import {expect} from 'chai';
import {spec} from '../../../modules/smartyadsBidAdapter.js';
import { config } from '../../../src/config.js';
import {server} from '../../mocks/xhr.js';

describe('SmartyadsAdapter', function () {
  const bid = {
    bidId: '23fhj33i987f',
    bidder: 'smartyads',
    params: {
      host: 'prebid',
      sourceid: '0',
      accountid: '0',
      traffic: 'banner'
    }
  };

  const bidResponse = {
    width: 300,
    height: 250,
    mediaType: 'banner',
    ad: `<img src='https://dummyimage.com/300x250&text=Test+Mode' width=300 height=250 alt='test mode'>`,
    requestId: '23fhj33i987f',
    cpm: 0.1,
    ttl: 120,
    creativeId: '123',
    netRevenue: true,
    currency: 'USD',
    dealId: 'HASH',
    sid: 1234
  };

  describe('isBidRequestValid', function () {
    it('Should return true if there are bidId, params and sourceid parameters present', function () {
      expect(spec.isBidRequestValid(bid)).to.be.true;
    });
    it('Should return false if at least one of parameters is not present', function () {
      delete bid.params.sourceid;
      expect(spec.isBidRequestValid(bid)).to.be.false;
    });
  });

  describe('buildRequests', function () {
    let serverRequest = spec.buildRequests([bid]);
    it('Creates a ServerRequest object with method, URL and data', function () {
      expect(serverRequest).to.exist;
      expect(serverRequest.method).to.exist;
      expect(serverRequest.url).to.exist;
      expect(serverRequest.data).to.exist;
    });
    it('Returns POST method', function () {
      expect(serverRequest.method).to.equal('POST');
    });
    it('Returns valid URL', function () {
      expect(serverRequest.url).to.be.oneOf([
        'https://n1.smartyads.com/?c=o&m=prebid&secret_key=prebid_js',
        'https://n2.smartyads.com/?c=o&m=prebid&secret_key=prebid_js',
        'https://n6.smartyads.com/?c=o&m=prebid&secret_key=prebid_js'
      ]);
    });
    it('Returns valid data if array of bids is valid', function () {
      const data = serverRequest.data;
      expect(data).to.be.an('object');
      expect(data).to.have.all.keys('deviceWidth', 'deviceHeight', 'host', 'page', 'placements', 'coppa', 'eeid', 'ifa');
      expect(data.deviceWidth).to.be.a('number');
      expect(data.deviceHeight).to.be.a('number');
      expect(data.coppa).to.be.a('number');
      expect(data.host).to.be.a('string');
      expect(data.page).to.be.a('string');
      const placement = data['placements'][0];
      expect(placement).to.have.keys('placementId', 'bidId', 'traffic', 'sizes', 'publisherId');
      expect(placement.placementId).to.equal('0');
      expect(placement.bidId).to.equal('23fhj33i987f');
      expect(placement.traffic).to.equal('banner');
    });
    it('Returns empty data if no valid requests are passed', function () {
      serverRequest = spec.buildRequests([]);
      const data = serverRequest.data;
      expect(data.placements).to.be.an('array').that.is.empty;
    });
  });

  describe('with COPPA', function() {
    beforeEach(function() {
      sinon.stub(config, 'getConfig')
        .withArgs('coppa')
        .returns(true);
    });
    afterEach(function() {
      config.getConfig.restore();
    });

    it('should send the Coppa "required" flag set to "1" in the request', function () {
      const serverRequest = spec.buildRequests([bid]);
      expect(serverRequest.data.coppa).to.equal(1);
    });
  });

  describe('interpretResponse', function () {
    it('Should interpret banner response', function () {
      const banner = {
        body: [{
          mediaType: 'banner',
          width: 300,
          height: 250,
          cpm: 0.4,
          ad: 'Test',
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1',
          meta: {advertiserDomains: ['example.com']}
        }]
      };
      const bannerResponses = spec.interpretResponse(banner);
      expect(bannerResponses).to.be.an('array').that.is.not.empty;
      const dataItem = bannerResponses[0];
      expect(dataItem).to.have.all.keys('requestId', 'cpm', 'width', 'height', 'ad', 'ttl', 'creativeId',
        'netRevenue', 'currency', 'dealId', 'mediaType', 'meta');
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.4);
      expect(dataItem.width).to.equal(300);
      expect(dataItem.height).to.equal(250);
      expect(dataItem.ad).to.equal('Test');
      expect(dataItem.meta).to.have.property('advertiserDomains');
      expect(dataItem.meta.advertiserDomains).to.be.an('array');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
    });
    it('Should interpret video response', function () {
      const video = {
        body: [{
          vastUrl: 'test.com',
          mediaType: 'video',
          cpm: 0.5,
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      const videoResponses = spec.interpretResponse(video);
      expect(videoResponses).to.be.an('array').that.is.not.empty;

      const dataItem = videoResponses[0];
      expect(dataItem).to.have.all.keys('requestId', 'cpm', 'vastUrl', 'ttl', 'creativeId',
        'netRevenue', 'currency', 'dealId', 'mediaType', 'meta');
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.5);
      expect(dataItem.vastUrl).to.equal('test.com');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
    });
    it('Should interpret native response', function () {
      const native = {
        body: [{
          mediaType: 'native',
          native: {
            clickUrl: 'test.com',
            title: 'Test',
            image: 'test.com',
            impressionTrackers: ['test.com'],
          },
          ttl: 120,
          cpm: 0.4,
          requestId: '23fhj33i987f',
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
        }]
      };
      const nativeResponses = spec.interpretResponse(native);
      expect(nativeResponses).to.be.an('array').that.is.not.empty;

      const dataItem = nativeResponses[0];
      expect(dataItem).to.have.keys('requestId', 'cpm', 'ttl', 'creativeId', 'netRevenue', 'currency', 'mediaType', 'native', 'meta');
      expect(dataItem.native).to.have.keys('clickUrl', 'impressionTrackers', 'title', 'image')
      expect(dataItem.requestId).to.equal('23fhj33i987f');
      expect(dataItem.cpm).to.equal(0.4);
      expect(dataItem.native.clickUrl).to.equal('test.com');
      expect(dataItem.native.title).to.equal('Test');
      expect(dataItem.native.image).to.equal('test.com');
      expect(dataItem.native.impressionTrackers).to.be.an('array').that.is.not.empty;
      expect(dataItem.native.impressionTrackers[0]).to.equal('test.com');
      expect(dataItem.ttl).to.equal(120);
      expect(dataItem.creativeId).to.equal('2');
      expect(dataItem.netRevenue).to.be.true;
      expect(dataItem.currency).to.equal('USD');
    });
    it('Should return an empty array if invalid banner response is passed', function () {
      const invBanner = {
        body: [{
          width: 300,
          cpm: 0.4,
          ad: 'Test',
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };

      const serverResponses = spec.interpretResponse(invBanner);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid video response is passed', function () {
      const invVideo = {
        body: [{
          mediaType: 'video',
          cpm: 0.5,
          requestId: '23fhj33i987f',
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      const serverResponses = spec.interpretResponse(invVideo);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid native response is passed', function () {
      const invNative = {
        body: [{
          mediaType: 'native',
          clickUrl: 'test.com',
          title: 'Test',
          impressionTrackers: ['test.com'],
          ttl: 120,
          requestId: '23fhj33i987f',
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
        }]
      };
      const serverResponses = spec.interpretResponse(invNative);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
    it('Should return an empty array if invalid response is passed', function () {
      const invalid = {
        body: [{
          ttl: 120,
          creativeId: '2',
          netRevenue: true,
          currency: 'USD',
          dealId: '1'
        }]
      };
      const serverResponses = spec.interpretResponse(invalid);
      expect(serverResponses).to.be.an('array').that.is.empty;
    });
  });
  describe('getUserSyncs', function () {
    const syncUrl = 'https://as.ck-ie.com/prebidjs?p=7c47322e527cf8bdeb7facc1bb03387a/iframe?pbjs=1&coppa=0';
    const syncOptions = {
      iframeEnabled: true
    };
    const userSync = spec.getUserSyncs(syncOptions);
    it('Returns valid URL and type', function () {
      expect(userSync).to.be.an('array').with.lengthOf(1);
      expect(userSync[0].type).to.exist;
      expect(userSync[0].url).to.exist;
      expect(userSync).to.deep.equal([
        { type: 'iframe', url: syncUrl }
      ]);
    });
  });
});
