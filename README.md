# @boardgame.io/p2p

> Experimental peer-to-peer multiplayer transport for [boardgame.io][bgio]

This package provides an experimental multiplayer transport implementation, which establishes a peer-to-peer connection between clients. Instead of using a Node.js server to maintain authoritative match state and communicate between clients, a host client maintains the authoritative state in their browser and manages connections between all the connected peers.

## Installation

```sh
npm install @boardgame.io/p2p
```

## Usage

```js
import { Client } from 'boardgame.io/client';
import { P2P } from '@boardgame.io/p2p';
import { MyGame } from './game';

const matchID = 'random-id-string';

// Host clients maintain the authoritative game state and manage
// communication between all other peers.
const hostClient = Client({
  game: MyGame,
  matchID,
  playerID: '0',
  multiplayer: P2P({ isHost: true }),
});

// Peer clients look up a host using the `matchID` and communicate
// with the host much like they would with a server.
const peerClient = Client({
  game: MyGame,
  matchID,
  playerID: '1',
  multiplayer: P2P(),
});
```

## API

### `P2P(options?)`

You can configure the peer-to-peer transport by passing an optional object. It can contain the following fields.

- #### `isHost`

  - **type:** `boolean`
  - **default:** `false`

  Controls whether or not this instance is a host and controls the authoritative game state. Only one client should have `isHost: true`.

- #### `peerOptions`

  - **type:** [`PeerJSOption`][pjo]
  - **default:** `undefined`

  Passed to PeerJS when creating a new `Peer` connection. [See PeerJS docs for full list of options →][pjo]

## Notes

### What does experimental mean?

This package currently works but is liable to change as what is required for peer-to-peer scenarios is better understood. Please try it out and send us feedback, bug reports and feature requests, but be aware that it may change in breaking ways until a more stable API is established.

### Why would I want to use this?

Deploying a Node server to enable multiplayer play can be a serious logistical hurdle and is often more expensive than serving a static website. This transport enables multiplayer play without a game server. If you’re looking for a casual way to play with friends that can be pretty attractive.

### What are the drawbacks?

No lobby or matchmaking. You have to have a `matchID` to find and connect to the other players. One pattern might be for a host to generate a random `matchID` on your site. Then they could share the `matchID` with friends via their preferred instant messaging service for example.

Additionally, currently if the host goes offline, the match will stop and potentially all match state will be lost. In the future it may be possible to decentralise this and allow other players to step in as hosts in this case.

### How does this work?

Under the hood this transport uses [PeerJS][pjs], a library that helps simplify creating peer-to-peer connections. When a host starts running, it registers with a so-called “handshake” server using a `matchID` to identify itself. Then when other clients connect, they can use the same `matchID` to request a connection to the host from the handshake server. Once that peer-to-peer connection is established between clients, all future communication will take place directly between clients and no longer pass via a server.

Unless configured otherwise, this transport will use [PeerJS’s default handshake server][psrvr] to negotiate the initial connection between peers. Consider running your own handshake server or [donating to PeerJS][poc] to help support theirs.

## Contributing

Bug reports, suggestions, and pull requests are very welcome! If you run into any problems or have questions, please [open an issue][newissue].

Please also note [the code of conduct][coc] and be kind to each other.

## License

The code in this repository is provided under [the MIT License](LICENSE).

[bgio]: https://boardgame.io/
[pjs]: https://github.com/peers/peerjs
[psrvr]: https://peerjs.com/peerserver.html
[poc]: https://opencollective.com/peer
[pjo]: https://peerjs.com/docs.html#peer-options
[netlify]: https://www.netlify.com/
[render]: https://render.com/
[newissue]: https://github.com/boardgameio/p2p/issues/new/choose
[coc]: CODE_OF_CONDUCT.md
