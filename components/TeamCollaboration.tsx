import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Cell
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, TOOLTIP_LABELS, CHART_LABELS, DISPLAY_CONFIG } from '../config/dashboardConfig';
import { CollaborationData, AverageTeamMembersData } from '@/types/dashboard';

interface TeamCollaborationProps {
    collaborationData: CollaborationData[];
    averageTeamMembersData: AverageTeamMembersData[];
    COLORS: string[];
}

const TeamCollaboration: React.FC<TeamCollaborationProps> = ({ 
    collaborationData, 
    averageTeamMembersData, 
    COLORS 
}) => {
    return (
        <div id="team-zusammenarbeit" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Team Zusammenarbeit</h2>
            <div className="grid grid-cols-1 gap-6">
                {/* Team Collaboration Network */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.TOP_COLLABORATIONS}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {collaborationData.slice(0, DISPLAY_CONFIG.TOP_COLLABORATIONS).map((collab, index) => (
                            <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-lg font-medium text-gray-800">
                                            {collab.source} + {collab.target}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            {collab.value} gemeinsame Issues
                                        </p>
                                    </div>
                                    <div className="text-2xl font-bold text-blue-600">
                                        #{index + 1}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Average Team Members per Issue */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.AVERAGE_TEAM_SIZE}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <BarChart data={averageTeamMembersData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                                dataKey="category"
                                interval={0}
                                tick={{ fontSize: 12 }}
                            />
                            <YAxis 
                                label={{ 
                                    value: 'Durchschnittliche Anzahl Teammitglieder', 
                                    angle: -90, 
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' }
                                }}
                                domain={[0, 'dataMax + 1']}
                            />
                            <Tooltip labelStyle={{ color: '#111827', fontWeight: 600 }} 
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}`, TOOLTIP_LABELS.TEAM_MEMBERS]}
                                labelFormatter={(label) => `${label}`}
                            />
                            <Legend />
                            <Bar 
                                dataKey="averageMembers" 
                                fill="#8884d8" 
                                name={CHART_LABELS.TEAM_SIZE}
                            >
                                {averageTeamMembersData.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={COLORS[index % COLORS.length]} 
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default TeamCollaboration; 