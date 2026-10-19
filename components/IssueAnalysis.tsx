import React from 'react';
import {
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer, Cell
} from 'recharts';
import { CHART_CONFIG, CHART_TITLES, TOOLTIP_LABELS, CHART_LABELS } from '@/config/dashboardConfig';
import { IssueComplexityData } from '@/types/dashboard';

interface IssueAnalysisProps {
    issueComplexityData: IssueComplexityData[];
    COLORS: string[];
}

const IssueAnalysis: React.FC<IssueAnalysisProps> = ({ issueComplexityData, COLORS }) => {
    return (
        <div id="issue-analyse" className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-6 text-gray-800">Issue Analyse</h2>
            <div className="grid grid-cols-1 gap-6">
                {/* Issue Complexity */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.ISSUE_COMPLEXITY}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <BarChart data={issueComplexityData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                                dataKey="category" 
                                angle={CHART_CONFIG.ANGLES.LABEL_ROTATION}
                                textAnchor="end"
                                height={70}
                                interval={0}
                            />
                            <YAxis 
                                label={{ 
                                    value: 'Durchschnittliche Zeit (Stunden)', 
                                    angle: -90, 
                                    position: 'insideLeft',
                                    style: { textAnchor: 'middle' }
                                }}
                            />
                            <Tooltip 
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.HOURS]}
                                labelFormatter={(label) => `${label}`}
                            />
                            <Legend />
                            <Bar 
                                dataKey="averageTime" 
                                fill="#82ca9d" 
                                name={CHART_LABELS.AVERAGE_TIME_PER_ISSUE}
                            >
                                {issueComplexityData.map((entry, index) => (
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

export default IssueAnalysis; 