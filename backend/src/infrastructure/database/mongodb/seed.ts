import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DEMO_CITY } from '@visor-protect/shared';
import { connectMongoDB, disconnectMongoDB } from './connection';
import { UserModel } from './models/User.model';
import { ShopModel } from './models/Shop.model';
import { EventLogModel } from './models/EventLog.model';
import { ConversationModel } from './models/Conversation.model';
import { MessageModel } from './models/Message.model';
import { DEMO_SHOPS_GEO_PATCH } from './demoShopGeo';

const DEMO_CONVERSATION_ID = '20000000-0000-4000-8000-000000000001';

const DEMO_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000099');
const DEMO2_OWNER_ID = new mongoose.Types.ObjectId('000000000000000000000098');
const DEMO_PASSWORD = 'demo1234';

const DEMO_SHOPS = DEMO_SHOPS_GEO_PATCH.map((shop) => ({
  ...shop,
  subscribed_event_types:
    shop._id === '00000000-0000-4000-8000-000000000002'
      ? (['ROBO', 'EMERGENCIA'] as const)
      : (['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'] as const),
  subscription: { status: 'ACTIVE' as const, trialEndsAt: new Date('2099-01-01') },
}));

async function seed(): Promise<void> {
  await connectMongoDB();

  await EventLogModel.deleteMany({});
  await MessageModel.deleteMany({});
  await ConversationModel.deleteMany({});
  await ShopModel.deleteMany({});
  await UserModel.deleteMany({});

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await UserModel.create({
    _id: DEMO_OWNER_ID,
    email: 'demo@visorprotect.local',
    password_hash: passwordHash,
    name: 'Comerciante Demo',
    role: 'OWNER',
    shop_ids: [DEMO_SHOPS[0]._id, DEMO_SHOPS[2]._id],
    is_active: true,
  });

  await UserModel.create({
    _id: DEMO2_OWNER_ID,
    email: 'demo2@visorprotect.local',
    password_hash: passwordHash,
    name: 'Comerciante Demo 2',
    role: 'OWNER',
    shop_ids: [DEMO_SHOPS[1]._id],
    is_active: true,
  });

  for (const shop of DEMO_SHOPS) {
    const ownerId =
      shop._id === DEMO_SHOPS[1]._id ? DEMO2_OWNER_ID : DEMO_OWNER_ID;
    await ShopModel.create({
      ...shop,
      owner_id: ownerId,
      socket_id: null,
    });
  }

  await EventLogModel.create([
    {
      _id: '10000000-0000-4000-8000-000000000001',
      shop_id: DEMO_SHOPS[0]._id,
      sender_shop_name: DEMO_SHOPS[0].name,
      city: DEMO_CITY,
      type: 'REEL_REPORT',
      category: 'SUSPICIOUS_PERSON',
      status: 'ACTIVE',
      description: 'Reporte rápido: Persona sospechosa',
      location: DEMO_SHOPS[0].location,
      icon_type: 'suspicious',
      confirmed_by: [DEMO_SHOPS[1]._id],
      confirmation_count: 1,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      _id: '10000000-0000-4000-8000-000000000002',
      shop_id: DEMO_SHOPS[1]._id,
      sender_shop_name: DEMO_SHOPS[1].name,
      city: DEMO_CITY,
      type: 'REEL_REPORT',
      category: 'VEHICLE',
      status: 'ACTIVE',
      description: 'Reporte rápido: Vehículo',
      location: DEMO_SHOPS[1].location,
      icon_type: 'theft',
      confirmed_by: [],
      confirmation_count: 0,
      createdAt: new Date(Date.now() - 90 * 60 * 1000),
    },
  ]);

  await ConversationModel.create({
    _id: DEMO_CONVERSATION_ID,
    participants: [DEMO_SHOPS[0]._id, DEMO_SHOPS[1]._id],
    type: 'DIRECT',
    last_message: {
      content: '¿Viste al sospechoso de hace rato?',
      sender_shop_id: DEMO_SHOPS[0]._id,
      sender_shop_name: DEMO_SHOPS[0].name,
      created_at: new Date(Date.now() - 15 * 60 * 1000),
      message_type: 'text',
    },
  });

  await MessageModel.create({
    _id: '20000000-0000-4000-8000-000000000002',
    conversation_id: DEMO_CONVERSATION_ID,
    sender_shop_id: DEMO_SHOPS[0]._id,
    sender_shop_name: DEMO_SHOPS[0].name,
    message_type: 'text',
    content: '¿Viste al sospechoso de hace rato?',
    read_by: [DEMO_SHOPS[0]._id],
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
  });

  console.log('[Seed] MongoDB Atlas poblado con datos demo');
  console.log(`[Seed] Ciudad: ${DEMO_CITY}`);
  console.log('[Seed] Usuario 1: demo@visorprotect.local / demo1234 (Comercio Demo Centro)');
  console.log('[Seed] Usuario 2: demo2@visorprotect.local / demo1234 (Comercio Demo Cercano)');
  await disconnectMongoDB();
}

seed().catch((error) => {
  console.error('[Seed] Error:', error);
  process.exit(1);
});
