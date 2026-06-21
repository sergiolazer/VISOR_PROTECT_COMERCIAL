import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectMongoDB, disconnectMongoDB } from './connection';
import { UserModel } from './models/User.model';
import { ShopModel } from './models/Shop.model';
import { EventLogModel } from './models/EventLog.model';
import { ConversationModel } from './models/Conversation.model';
import { MessageModel } from './models/Message.model';

const DEMO_CONVERSATION_ID = '20000000-0000-4000-8000-000000000001';

const DEMO_OWNER_ID = new mongoose.Types.ObjectId('00000000-0000-4000-8000-000000000099');
const DEMO_PASSWORD = 'demo1234';

const DEMO_SHOPS = [
  {
    _id: '00000000-0000-4000-8000-000000000001',
    name: 'Comercio Demo Centro',
    address: 'Av. Paulista 1000, São Paulo',
    city: 'São Paulo',
    location: { type: 'Point' as const, coordinates: [-46.6553, -23.5614] },
    subscribed_event_types: ['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'],
    subscription: { status: 'ACTIVE' as const, trialEndsAt: new Date('2099-01-01') },
  },
  {
    _id: '00000000-0000-4000-8000-000000000002',
    name: 'Comercio Demo Cercano',
    address: 'Av. Paulista 1050, São Paulo',
    city: 'São Paulo',
    location: { type: 'Point' as const, coordinates: [-46.6548, -23.5610] },
    subscribed_event_types: ['ROBO', 'EMERGENCIA'],
    subscription: { status: 'ACTIVE' as const, trialEndsAt: new Date('2099-01-01') },
  },
  {
    _id: '00000000-0000-4000-8000-000000000003',
    name: 'Comercio Demo Lejano',
    address: 'Rua Augusta 500, São Paulo',
    city: 'Rio de Janeiro',
    location: { type: 'Point' as const, coordinates: [-43.1729, -22.9068] },
    subscribed_event_types: ['ROBO', 'ACCIDENTE', 'SOSPECHOSO', 'INTRUSION', 'VANDALISMO', 'EMERGENCIA'],
    subscription: { status: 'ACTIVE' as const, trialEndsAt: new Date('2099-01-01') },
  },
];

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
    shop_ids: DEMO_SHOPS.map((shop) => shop._id),
    is_active: true,
  });

  for (const shop of DEMO_SHOPS) {
    await ShopModel.create({
      ...shop,
      owner_id: DEMO_OWNER_ID,
      socket_id: null,
    });
  }

  await EventLogModel.create([
    {
      _id: '10000000-0000-4000-8000-000000000001',
      shop_id: DEMO_SHOPS[0]._id,
      sender_shop_name: DEMO_SHOPS[0].name,
      city: 'São Paulo',
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
      city: 'São Paulo',
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
  console.log('[Seed] Login demo: demo@visorprotect.local / demo1234');
  await disconnectMongoDB();
}

seed().catch((error) => {
  console.error('[Seed] Error:', error);
  process.exit(1);
});
