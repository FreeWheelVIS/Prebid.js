# Overview

```
Module Name: 360PlayVid Bidder Adapter
Module Type: 360PlayVid Bidder Adapter
Maintainer: prebid@360playvid.com
```

# Description

Connects to 360PlayVid exchange for bids.
360PlayVid bid adapter supports Banner, Video (instream and outstream) and Native.

# Test Parameters
```
    var adUnits = [
                // Will return static test banner
                {
                    code: 'adunit1',
                    mediaTypes: {
                        banner: {
                            sizes: [ [300, 250], [320, 50] ],
                        }
                    },
                    bids: [
                        {
                            bidder: '360playvid',
                            params: {
                                placementId: 'testBanner',
                            }
                        }
                    ]
                },
                {
                    code: 'addunit2',
                    mediaTypes: {
                        video: {
                            playerSize: [ [640, 480] ],
                            context: 'instream',
                            minduration: 5,
                            maxduration: 60,
                        }
                    },
                    bids: [
                        {
                            bidder: '360playvid',
                            params: {
                                placementId: 'testVideo',
                            }
                        }
                    ]
                },
                {
                    code: 'addunit3',
                    mediaTypes: {
                        native: {
                            title: {
                                required: true
                            },
                            body: {
                                required: true
                            },
                            icon: {
                                required: true,
                                size: [64, 64]
                            }
                        }
                    },
                    bids: [
                        {
                            bidder: '360playvid',
                            params: {
                                placementId: 'testNative',
                            }
                        }
                    ]
                }
            ];
```
