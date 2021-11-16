# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.4.1](https://github.com/boardgameio/p2p/compare/v0.4.0...v0.4.1) (2021-11-16)


### Bug Fixes

* Keep `credentials` & signing keys in sync ([264c6dc](https://github.com/boardgameio/p2p/commit/264c6dccc6620f5dac4254305edbf040136c0ef6))

## [0.4.0](https://github.com/boardgameio/p2p/compare/v0.3.0...v0.4.0) (2021-11-15)


### Features

* Use private key authentication ([#10](https://github.com/boardgameio/p2p/issues/10)) ([6f6176d](https://github.com/boardgameio/p2p/commit/6f6176d8f17c900dccdc468e9a51c002cfadb7ef))


### Bug Fixes

* **host:** Correctly type host options ([d09840f](https://github.com/boardgameio/p2p/commit/d09840f58b7b748afb67f04109227a88c6fd3db9))

## [0.3.0](https://github.com/boardgameio/p2p/compare/v0.2.1...v0.3.0) (2021-10-11)


### Features

* Retry connecting to host on connection failure ([edefccb](https://github.com/boardgameio/p2p/commit/edefccb48bccce281dd5fe9b338e41b001c0fbd7)), closes [#7](https://github.com/boardgameio/p2p/issues/7)


### Bug Fixes

* Sanitise the host ID to ensure it passes PeerJS validation ([f46b72d](https://github.com/boardgameio/p2p/commit/f46b72dfb3a14863a6ea4c6129bed54d031c52aa))

### [0.2.1](https://github.com/boardgameio/p2p/compare/v0.2.0...v0.2.1) (2021-10-10)


### Features

* Add onError callback ([14ecafe](https://github.com/boardgameio/p2p/commit/14ecafe4119261b6417a1cd3d067179373a8ce97)), closes [#5](https://github.com/boardgameio/p2p/issues/5)

## [0.2.0](https://github.com/boardgameio/p2p/compare/v0.1.1...v0.2.0) (2021-10-07)


### Features

* Apply game `playerView` to state sent to clients ([dd099dd](https://github.com/boardgameio/p2p/commit/dd099dddcf6cbd7eb6f9605ee220722cb4d4a737)), closes [#2](https://github.com/boardgameio/p2p/issues/2)


### Bug Fixes

* Also include credentials when unregistering clients ([df108ef](https://github.com/boardgameio/p2p/commit/df108efb82006bb87037596cd63db11a24a6663d))

### [0.1.1](https://github.com/boardgameio/p2p/compare/v0.1.0...v0.1.1) (2021-10-06)


### Features

* Authenticate clients on registration to protect `playerID`s ([#6](https://github.com/boardgameio/p2p/issues/6)) ([9d7f09a](https://github.com/boardgameio/p2p/commit/9d7f09aa087d94090cbcf1ec31be3f8fb1af991e))

## 0.1.0 (2021-10-03)
