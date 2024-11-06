import { Vec3 } from 'vec3';

import { PublicEventHandler } from '../../util/events.js';
import type { Packet } from '../../util/packet.js';
import type { AsyncVoid } from '../../util/types.js';
import proxy from '../internal.proxy/local.js';

// #region Types

// #region Base

interface RawVec3 {
  x: number;
  y: number;
  z: number;
}

interface Orientation {
  pitch: number;
  yaw: number;
}

// #endregion

// #region Packet Data

interface UpstreamPositionPacketData extends RawVec3 {
  onGround: boolean;
}

interface UpstreamLookPacketData extends Orientation {
  onGround: boolean;
}

interface DownstreamPositionPacketData extends RawVec3, Orientation {
  flags: number;
  teleportId: number;
}

// #endregion

// #region Event Map

interface UpstreamEventMap {
  position: (packet: Packet<UpstreamPositionPacketData>) => AsyncVoid;
  // minecraft calls this "look", however, I prefer "orientation"
  orientation: (packet: Packet<UpstreamLookPacketData>) => AsyncVoid;
}

interface DownstreamEventMap {
  // minecraft calls this "position", however, it also includes
  // orientation data, so I decided to call it "pose"
  pose: (packet: Packet<DownstreamPositionPacketData>) => AsyncVoid;
}

interface BiEventMap {
  position: (
    packet:
      | Packet<UpstreamPositionPacketData>
      | Packet<DownstreamPositionPacketData>,
  ) => AsyncVoid;
  orientation: (
    packet:
      | Packet<UpstreamLookPacketData>
      | Packet<DownstreamPositionPacketData>,
  ) => AsyncVoid;
}

// #endregion

// #endregion

export const pose = {
  upstream: new PublicEventHandler<UpstreamEventMap>(),
  downstream: new PublicEventHandler<DownstreamEventMap>(),
  bi: new PublicEventHandler<BiEventMap>(),
  position: new Vec3(NaN, NaN, NaN),
  orientation: { pitch: NaN, yaw: NaN } as Orientation,
  onGround: false,
};

// #region Events

// #region bi events -> pose data

pose.bi.on('position', async (packet) => {
  const data = packet.data;

  pose.position.set(data.x, data.y, data.z);

  if ('onGround' in data) pose.onGround = data.onGround;
});

pose.bi.on('orientation', async (packet) => {
  const data = packet.data;

  pose.orientation.yaw = data.yaw;
  pose.orientation.pitch = data.pitch;

  if ('onGround' in data) pose.onGround = data.onGround;
});

// #endregion

// #region pose events -> bi events

pose.upstream.on('position', async (packet) => {
  await pose.bi.emit('position', packet);
});

pose.upstream.on('orientation', async (packet) => {
  await pose.bi.emit('orientation', packet);
});

pose.downstream.on('pose', async (packet) => {
  await pose.bi.emit('position', packet);
  await pose.bi.emit('orientation', packet);
});

// #endregion

// #region proxy events -> pose events

proxy.upstream.on('position', async (packet) => {
  await pose.upstream.emit(
    'position',
    packet as Packet<UpstreamPositionPacketData>,
  );
});

proxy.upstream.on('look', async (packet) => {
  await pose.upstream.emit(
    'orientation',
    packet as Packet<UpstreamLookPacketData>,
  );
});

proxy.upstream.on('position_look', async (packet) => {
  await pose.upstream.emit(
    'position',
    packet as Packet<UpstreamPositionPacketData>,
  );

  await pose.upstream.emit(
    'orientation',
    packet as Packet<UpstreamLookPacketData>,
  );
});

proxy.downstream.on('position', async (packet) => {
  await pose.downstream.emit(
    'pose',
    packet as Packet<DownstreamPositionPacketData>,
  );
});

// #endregion

// #endregion
