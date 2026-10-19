import React from 'react';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import {CHART_CONFIG, CHART_TITLES, TOOLTIP_LABELS} from '../config/dashboardConfig';

interface TeamAndCategoriesProps {
    pieData: Array<{ name: string; value: number }>;
    barData: Array<{ name: string; value: number }>;
    COLORS: string[];
    userLastLogged: Record<string, string | null>;
    teamMembers: string[];
    selectedCategory: string | null;
    onCategorySelect: (category: string | null) => void;
}

const TeamAndCategories: React.FC<TeamAndCategoriesProps> = ({ pieData, barData, COLORS, userLastLogged, teamMembers, selectedCategory, onCategorySelect }) => {
    const formatLastLogged = (iso: string | null) => {
        if (!iso) return 'Noch keine Buchung';
        const d = new Date(iso);
        const days = Math.floor((Date.now() - d.getTime()) / 86400000);
        if (days === 0) return 'Heute';
        if (days === 1) return 'Gestern';
        return `vor ${days} Tagen`;
    };
    return (
        <div id="team-kategorien" className="bg-white p-4 rounded-lg shadow">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-800">Team & Kategorien</h2>
                {selectedCategory && (
                    <button
                        onClick={() => onCategorySelect(null)}
                        className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                        {selectedCategory} ✕
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-6">
                {/* Category Distribution */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                        {CHART_TITLES.CATEGORY_DISTRIBUTION}
                        {!selectedCategory && <span className="ml-2 text-xs text-gray-400">(Klicken zum Filtern)</span>}
                    </h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <PieChart>
                            <Pie
                                dataKey="value"
                                data={pieData}
                                outerRadius={100}
                                cursor="pointer"
                                onClick={(entry) => onCategorySelect(selectedCategory === entry.name ? null : entry.name)}
                                label={({
                                            name,
                                            value
                                        }) => value !== undefined ? `${name}\n${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h` : name}>
                                {pieData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.HOURS]}/>
                            <Legend/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Team Activity */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{CHART_TITLES.TEAM_ACTIVITY}</h4>
                    <ResponsiveContainer width="100%" height={CHART_CONFIG.HEIGHTS.MEDIUM}>
                        <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3"/>
                            <XAxis dataKey="name"/>
                            <YAxis/>
                            <Tooltip
                                formatter={(value: number) => [`${value.toFixed(CHART_CONFIG.DECIMAL_PLACES)}h`, TOOLTIP_LABELS.HOURS]}/>
                            <Legend/>
                            <Bar dataKey="value" fill="#8884d8"/>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Per-user last logged */}
                <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Letzte Buchung pro Teammitglied</h4>
                    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
                        {teamMembers.map(username => {
                            const last = userLastLogged[username] ?? null;
                            const hasLogged = last !== null;
                            return (
                                <div key={username} className="flex items-center justify-between px-4 py-2">
                                    <span className={`font-medium ${hasLogged ? 'text-gray-800' : 'text-red-500'}`}>
                                        {username}
                                    </span>
                                    <span className={`text-xs ${hasLogged ? 'text-gray-500' : 'text-red-400 font-semibold'}`}>
                                        {formatLastLogged(last)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamAndCategories; 