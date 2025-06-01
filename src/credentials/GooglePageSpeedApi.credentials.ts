import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class GooglePageSpeedApi implements ICredentialType {
	name = 'googlePageSpeedApi';
	displayName = 'Google PageSpeed API';
	documentationUrl = 'https://developers.google.com/speed/docs/insights/v5/get-started';
	
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Google PageSpeed Insights API key. Get it from Google Cloud Console.',
			placeholder: 'AIzaSyC...',
		},
	];

	authenticate = {
		type: 'generic',
		properties: {
			qs: {
				key: '={{$credentials.apiKey}}',
			},
		},
	} as const;

	test = {
		request: {
			baseURL: 'https://www.googleapis.com/pagespeedonline/v5',
			url: '/runPagespeed',
			method: 'GET',
			qs: {
				url: 'https://www.google.com',
				strategy: 'mobile',
				category: 'performance',
			},
		},
	} as const;
}