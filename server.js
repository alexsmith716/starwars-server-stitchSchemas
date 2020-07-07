import express from 'express';
import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import cors from 'cors';

import { print } from 'graphql';
import fetch from 'node-fetch';

// ==========================================================

import {
	introspectSchema,
} from 'graphql-tools';

import {
	stitchSchemas,
} from '@graphql-tools/stitch';

import {
	delegateToSchema,
	FilterToSchema,
} from '@graphql-tools/delegate';

import {
	wrapSchema,
	FilterRootFields,
	RenameTypes,
	RenameRootFields,
	TransformQuery,
} from '@graphql-tools/wrap';

import {
	mapSchema,
	MapperKind,
	getDirectives,
} from '@graphql-tools/utils';

// ==========================================================

import swapiSchema from './data/schema';

const PORT = 4001;
const app = express();
app.use('*', cors());

// --------------------------------------------------------------

//	SchemaTransform,
//	transformSchema
//	delegateToSchema

//	https://swapi.dev/about
//	https://swapi.dev/documentation
//	https://swapi.dev/api/people/1/

//	schema discovery

//	working with remote schemas
//	schema-wrapping 

//	namespaces
//	check for type name collisions
//	Apollo's default behaviour is take the last API in as the final definition
//	resolve by transforming the API before merging
//	'stitchSchemas' will by default pick the implementation of the last schema that was passed to it
//	https://www.advancedgraphql.com/content/schema-stitching/ex3

//	In most cases, the last API in wins in name collisions, 
//		but that’s not what we want – we want each API to be able to work internally, 
//		and we want to avoid collisions, both in calls, internal function calls, naming conventions, 
//		and generally as a point of data integrity.

// --------------------------------------------------------------

//	Executor::
//		an executor is a function capable of retrieving GraphQL results
//		used to do introspection or fetch results during execution
const executor = async ({ document, variables }) => {
	const query = print(document);
	const fetchResult = await fetch('https://rickandmortyapi.com/graphql', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables })
	});
	return fetchResult.json();
};

// --------------------------------------------------------------

//	createRemoteSchema
async function apolloServer() {

	//	Remote schemas::
	//		Create a remote executable schema with custom executor:
	//			1. Create a executor that can retrieve results from that schema
	//			2. Use introspectSchema to get the non-executable schema of the remote server
	//			3. Use wrapSchema to create a schema that uses the executor to delegate requests to the underlying service
	//	https://www.graphql-tools.com/docs/remote-schemas/#creating-a-subscriber
	//	======================================================================
	//	introspection: discover the schemas, and merges all of the types together
	//	makeRemoteExecutableSchema => wrapSchema

	const remoteSchemaRickandmortyapi = await introspectSchema(executor);

	//	const remoteSchemaRickandmortyapi = new SchemaTransform(remoteSchemaRickandmortyapiX, [
	//		new RenameTypes((name) => `Chirp_${name}`),
	//		new RenameRootFields((name) => `Chirp_${name}`),
	//	]);

	const wrappedSchema = wrapSchema({
		schema: remoteSchemaRickandmortyapi,
		executor,
	});

	const chirpSchemaTransforms = [
		new RenameTypes((name) => `Chirp_${name}`),
		new RenameRootFields((name) => `Chirp_${name}`),
	];

	const chirpSubschema = {
		schema: wrappedSchema,
		transforms: chirpSchemaTransforms,
	}

	//	mergeSchemas => stitchSchemas
	const finalSchema = stitchSchemas({
		subschemas: [
			// swapiSchema,
			// wrappedSchema,
			// { schema: swapiSchema },		<<<< BAD
			// { schema: wrappedSchema },	<<<< BAD
			// { schema: swapiSchema },
			// { schema: chirpSubschema },
			swapiSchema,
			chirpSubschema
		],
	});

	const server = new ApolloServer({
		//	schema: schema,
		schema: finalSchema,
		subscriptions: { path: "/websocket" }
	});

	server.applyMiddleware({ app });
	const httpServer = createServer(app);
	server.installSubscriptionHandlers(httpServer);
	
	httpServer.listen(PORT, () => {
		console.log(`🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`);
		console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}${server.subscriptionsPath}`);
	});
}

// --------------------------------------------------------------

try {
	console.log('>>>> APOLLO SERVER > START');
	apolloServer();
}  catch (err) {
	console.log('>>>> APOLLO SERVER > ERROR: ', err);
}

// --------------------------------------------------------------

// The type of Query.hero(episode:) must be Input Type but got: Episode.
// 
// The type of Query.reviews(episode:) must be Input Type but got: Episode!.
// 
// The type of Mutation.createReview(episode:) must be Input Type but got: Episode.
// 
// The type of Subscription.reviewAdded(episode:) must be Input Type but got: Episode.
// 
// Type Human must only implement Interface types, it cannot implement Character.
// 
// Type Droid must only implement Interface types, it cannot implement Character.
