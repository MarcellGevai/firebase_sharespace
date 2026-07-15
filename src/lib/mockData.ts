export type User = {
	id: string;
	name: string;
	avatar_url: string;
	location: string;
	trust_score: number;
};

export type ListingType = 'ITEM' | 'SERVICE';
export type ListingStatus = 'AVAILABLE' | 'UNAVAILABLE';

export type Listing = {
	id: string;
	owner_id: string;
	title: string;
	description: string;
	image_url: string;
	type: ListingType;
	status: ListingStatus;
	category?: string;
};

export const mockUsers: Record<string, User> = {
	'u1': {
		id: 'u1',
		name: 'Alice Cooper',
		avatar_url: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
		location: 'Budapest, XI.',
		trust_score: 4.9
	},
	'u2': {
		id: 'u2',
		name: 'Bob Builder',
		avatar_url: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
		location: 'Budapest, XI.',
		trust_score: 4.5
	},
	'u3': {
		id: 'u3',
		name: 'Charlie Davis',
		avatar_url: 'https://i.pravatar.cc/150?u=a04258a2462d826712d',
		location: 'Budapest, XI.',
		trust_score: 4.2
	}
};

export const mockListings: Listing[] = [
	{
		id: 'l1',
		owner_id: 'u1',
		title: 'Bosch Power Drill',
		description: 'Heavy duty power drill. Includes a set of standard bits. Perfect for home improvement projects.',
		image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=600&q=80',
		type: 'ITEM',
		status: 'AVAILABLE',
		category: 'Szerszámok'
	},
	{
		id: 'l2',
		owner_id: 'u2',
		title: 'Lawn Mower',
		description: 'Electric lawn mower, easy to use and quiet. Need it back by the weekend.',
		image_url: 'https://images.unsplash.com/photo-1592424005686-2f085e3474fc?auto=format&fit=crop&w=600&q=80',
		type: 'ITEM',
		status: 'AVAILABLE',
		category: 'Kert'
	},
	{
		id: 'l3',
		owner_id: 'u3',
		title: 'Math Tutoring',
		description: 'Can help high schoolers with Algebra and Calculus. Available on weekday evenings.',
		image_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80',
		type: 'SERVICE',
		status: 'AVAILABLE',
		category: 'Tevékenységek'
	},
	{
		id: 'l4',
		owner_id: 'u1',
		title: 'Camping Tent (4-person)',
		description: 'Spacious 4-person tent, waterproof and easy to set up. Used only twice.',
		image_url: 'https://images.unsplash.com/photo-1504280390226-0e0600a9d16b?auto=format&fit=crop&w=600&q=80',
		type: 'ITEM',
		status: 'AVAILABLE',
		category: 'Sport'
	}
];
